const config = require("../config/index.js")
const { ErrorResponse, Constants } = require("../utils/constant")
const amqplib = require("amqplib")
const logger = require("../utils/logger")
class MQService{
    constructor() {
        this.connection = null;
        this.channel = null;
        this.mqUrl = config.MQ_URL;
    }
    async connect(){
        try {
            if (this.connection) return;
            // Case ngọt sớt
            this.connection = await amqplib.connect(this.mqUrl);
            this.channel = await this.connection.createChannel();
            // Case MQ đóng
            this.connection.on('close', () =>{
                console.error('MQ closed')
                this.connection = null;
                this.channel = null;
                // Cố gắng reset state
                setTimeout(() => this.connect(), 5000) // 
            })
            
            // Case MQ connection failed
            this.connection.on('error', (err) =>{
                throw new ErrorResponse("MQ FAILED: ",err.message)
            })
            logger.info("✅ MQ connected successfully")
        } catch (error) {
            next(new ErrorResponse(error.message, 500))
        }
    }
    async checkChannel(){
        try {
            if (!this.channel){
                await this.connect()
            }
            if (!this.channel) throw new ErrorResponse("This channel not available!")
            return this.channel
        } catch (error) {
            next(new ErrorResponse(error.message, 500))
        }
    }
    async setupExchangeAndQueue(channel, exchange, exchangeType,queueName, routingKey){
        await channel.assertExchange(exchange, exchangeType, { durable: true})
        await channel.assertQueue(queueName, { durable: true})
        await channel.bindQueue(queueName, exchange, routingKey)
    }
    // Options persistent sẽ giúp 
    async sendTask(queueName, 
                message, 
                exchange ="", 
                exchangeType="direct", 
                routingKey= queueName, 
                options = { persistent: true}){
        try {
            const channel = await this.checkChannel()
            // Chuan bi message
            const msgBuffer = Buffer.from(JSON.stringify(message))

            // exchange = default => gui truc tiep
            if (exchange === ""){
                await channel.assertQueue(queueName, { durable: true })
                channel.sendToQueue(queueName, msgBuffer, options)
                logger.log('[ x ] send message to queue ',queueName)
            }
            else {
                await this.setupExchangeAndQueue(channel, exchange, exchangeType, queueName, routingKey)
                // Gửi đến exchange, rồi exchange route tới queue 
                channel.publish(exchange, routingKey, msgBuffer, options);
                logger.info(`Published message to exchange "${exchange}" with routingKey "${routingKey}"`);
            }
        } catch (error) {
            logger.error(`[!] Failed to send message to queue ${queueName}:`, error);
            next(new ErrorResponse(error.message, 500))
        }
    }
    /** Gửi message trực tiếp đến queue (default exchange) */
    async sendDirect(queueName, message, options) {
        return this.sendTask({ queueName, message, exchange: "", routingKey: queueName, options });
    }

    /** Gửi message qua exchange kiểu direct */
    async sendToDirectExchange(exchange, routingKey, message, options) {
        return this.sendTask({ exchange, exchangeType: "direct", routingKey, message, options });
    }

    /** Gửi message qua exchange kiểu topic */
    async sendToTopicExchange(exchange, routingKey, message, options) {
        return this.sendTask({ exchange, exchangeType: "topic", routingKey, message, options });
    }

    /** Gửi message qua exchange kiểu fanout (broadcast đến tất cả queue đã bind) */
    async sendToFanoutExchange(exchange, message, options) {
        return this.sendTask({ exchange, exchangeType: "fanout", routingKey: "", message, options });
    }
   async consumeTask({
        queueName,
        onCallBackHandler,
        exchangeName = null,
        bindingKey = '',
        exchangeType = 'direct',
        msgAmount = 1,
        allUpTo = false,
        requeue = false,
        autoAck = false,
        channel = null 
        }) {
        try {
            const ch = channel || await this.checkChannel();

            // Setup exchange and queue binding
            if (exchangeName) {
                await ch.assertExchange(exchangeName, exchangeType, { durable: true });
                await ch.assertQueue(queueName, { durable: true });
                await ch.bindQueue(queueName, exchangeName, bindingKey);
                logger.info(`[MQ] Bound queue "${queueName}" to exchange "${exchangeName}" with key "${bindingKey}"`);
            } else {
                await ch.assertQueue(queueName, { durable: true });
                logger.info(`[MQ] Asserted queue "${queueName}" (direct mode)`);
            }
            
            // Set prefetch
            ch.prefetch(msgAmount);

            // Listen for channel errors
            ch.on('error', (err) => {
                logger.error(`[MQ] Channel error on ${queueName}:`, err);
            });

            ch.on('close', () => {
                logger.warn(`[MQ] Channel closed for ${queueName}`);
            });

            // Start consuming
            const { consumerTag } = await ch.consume(queueName, async (msg) => {
                if (!msg) {
                    logger.warn(`[MQ] Received null message on ${queueName}`);
                    return;
                }

                let content;
                const msgId = msg.properties.messageId || 'no-id';

                try {
                    content = JSON.parse(msg.content.toString());
                    logger.info(`[✔] Received task from ${queueName} | id=${msgId}`);

                    await onCallBackHandler(content, msg, ch);

                    if (!autoAck) {
                        ch.ack(msg);
                        logger.info(`[✔] Acked message ${msgId}`);
                    }
                } catch (error) {
                    logger.error(`[✖] Error processing message ${msgId}:`, error);

                    if (!autoAck) {
                        ch.nack(msg, allUpTo, requeue);
                        logger.warn(`[✖] Nacked message ${msgId} | requeue=${requeue}`);
                    }
                }
            }, { 
                noAck: autoAck,
                exclusive: false
            });

            logger.info(`[MQ] Consumer started for ${queueName} | tag=${consumerTag}`);
            
            return consumerTag;

        } catch (error) {
            logger.error(`[MQ] Failed to start consumer for ${queueName}:`, error);
            throw new ErrorResponse(error.message, 500);
        }
    }
    // Close connection với MQ duy nhất khi server - down 
    async close(){
        try {
            if (this.channel) await this.channel.close()
            if (this.connection) await this.connection.close()
            this.connection = null;
            this.channel = null;
        } catch (error) {
            next(new ErrorResponse(error.message, 500))
        }
    }
}
module.exports = new MQService()
const { default: axios } = require("axios");
const MQService = require("../services/MQService");
const { Constants, ErrorResponse } = require("../utils/constant");
const logger = require("../utils/logger");
const { successResponse, errorResponse } = require("../utils/response");
const redisMQ = require("../config/redis-mq")
const AI_DOMAIN = "http://localhost:8400"
// Constants.QUEUE_NAME[chNormalization[req.params.channel]]
const sendMessage = (io, socket) => {
  socket.on("send_message", (data) => {
    const { user_id, message } = data;
    
    if (!user_id || !message) {
      socket.emit("error", { msg: "Thiếu user_id hoặc message" });
      return;
    }
    socket.join(user_id);
    console.log(`Socket ${socket.id} joined room ${user_id}`);
    console.log(`Tin nhắn từ ${user_id}: ${message}`);
    io.to(user_id).emit("received" , {msg: "Da nhan"});
  });
};

const enableChat = async (req, res, next) => {
  const payload = req.body
  try {
    await axios.post(`${AI_DOMAIN}/enable_chat`, payload)
    return successResponse(res, `Successfully`)
  } catch (error) {
    next(error)
  }
}
const disableChat = async ( req, res, next ) =>{
  const id = req.params.id
  try {
    // Save for development 
    if (!id) throw new ErrorResponse("Lack of conversation id", Constants.BAD_REQUEST)
    await axios.post(`${AI_DOMAIN}/disable_chat`, { conversationId : id })
    return successResponse(res, "Successfully")
  } catch (error) {
    next(error)
  }
} 
const chNormalization = {
  'facebook': 'FACEBOOK',
  'zalo': 'ZALO',
  'website': 'WEB',
}
// Hàm này sẽ được gọi sau 10 giây
const processAndSendToMQ = async (conversationId, groupId, channelKey) => {
    const redisKey = getRedisKey(conversationId, groupId);

    try {
        // 1. Lấy tất cả tin nhắn từ Redis List
        // Lệnh LRANGE 0 -1 lấy tất cả phần tử
        const stackedMessages = await redisMQ.lrange(redisKey, 0, -1); 
        
        if (stackedMessages.length === 0) {
            console.log(`[MQ] Không có tin nhắn nào trong Redis cho ID: ${conversationId}. Bỏ qua.`);
            return;
        }

        // 2. Tạo gói tin nhắn cuối cùng
        // Lấy tin nhắn cuối cùng trong stack (tin nhắn đến sau cùng, nằm ở đầu Redis List)
        const latestMessage = stackedMessages.toString(); 
        
        // Tạo gói tin nhắn để gửi đi
        const messagePkg = {
            message: latestMessage, // Chỉ gửi tin nhắn cuối cùng (tối ưu cho LLM)
            conversationId,
            groupId,
            channel: channelKey,
            // Bạn có thể thêm toàn bộ lịch sử stack vào đây nếu LLM cần:
            // messageStack: stackedMessages 
        };
        
        console.log(`[MQ] Gửi tin nhắn nhóm (Stack size: ${stackedMessages.length}) cho ID: ${conversationId}`);
        
        // 3. Gửi tin nhắn vào RabbitMQ
        await MQService.sendTask(Constants.QUEUE_NAME.BOT, 
            messagePkg,
            Constants.EXCHANGE.TOPIC,
            "topic",
            Constants.ROUTING_KEY[`${chNormalization[channelKey]}_SEND`],
            { persistent: true }
        );
        logger.log(`[ x ] Đã gửi tin nhắn thành công tới ${Constants.QUEUE_NAME.BOT}`);

    } catch (error) {
        logger.error(`Lỗi khi xử lý lô tin nhắn cho ID ${conversationId}: ${error.message}`);
        // Giữ lại trong Redis để thử lại sau nếu MQ bị lỗi nặng
    } finally {
        // 4. Xóa List tin nhắn trong Redis sau khi xử lý thành công (hoặc thất bại)
        // Dùng DEL để xóa toàn bộ key
        await redisMQ.del(redisKey);
        
        // 5. Xóa timer trong bộ nhớ
        if (ACTIVE_TIMERS[conversationId]) {
            delete ACTIVE_TIMERS[conversationId];
        }
    }
};
// Đặt ngoài hàm sendMessageOnPlatform
const ACTIVE_TIMERS = {}; // Key: conversationId, Value: timerId
const DEBOUNCE_TIME_MS = 10000; // 10 giây
const getRedisKey = (conversationId, groupId) => {
  return `msg:${conversationId}:${groupId}`;
};
const sendMessageOnPlatform = async ( req, res, next ) => {
    const messagePkg = req.body;
    const { conversationId, groupId, message } = messagePkg;
    const channelKey = req.params.channel;
    
    if (!channelKey || !chNormalization[channelKey]) {
        return next(new Error(`Invalid channel: ${req.params.channel}`));
    }

    const redisKey = getRedisKey(conversationId, groupId);
    
    try {
        // 1. Lưu tin nhắn vào Redis List (lpush)
        // Tin nhắn mới nhất sẽ nằm ở vị trí 0
        await redisMQ.lpush(redisKey, message); 
        console.log(`[Redis] Tin nhắn mới cho ID ${conversationId} được thêm vào List.`);

        // 2. Kiểm tra và hủy Timer cũ
        if (ACTIVE_TIMERS[conversationId]) {
            // Nếu có, HỦY bỏ timer cũ (reset thời gian chờ)
            clearTimeout(ACTIVE_TIMERS[conversationId]);
            console.log(`[Debounce] Hủy timer cũ, reset 10s cho ID: ${conversationId}.`);
        }

        // 3. Thiết lập Timer mới 10 giây
        const timerId = setTimeout(() => {
            // Khi hết 10 giây, gọi hàm xử lý lô
            processAndSendToMQ(conversationId, groupId, channelKey);
        }, DEBOUNCE_TIME_MS);

        // 4. Cập nhật/Lưu trữ Timer ID mới vào bộ nhớ
        ACTIVE_TIMERS[conversationId] = timerId;
        
        // 5. Trả lời ngay cho Client
        return successResponse(res, "Message buffered in Redis. Processing will start in 10s.");

    } catch (error) {
        logger.error(`Lỗi trong sendMessageOnPlatform: ${error.message}`);
        next(error);
    }
}
const updateAISetting = async ( req, res, next ) => {
  const payload = req.body
  try {
    const response = await axios.post(`${AI_DOMAIN}/ai_setting`, payload)
    return successResponse(res, response.data, "Successfully")
  } catch (error) {
    next(error)
  }
}
const getAISetting = async ( req, res, next ) => {
  const groupId = req.params.id
  try {
    const response = await axios.get(`${AI_DOMAIN}/ai_setting/${groupId}`)
    return successResponse(res, response.data, "Successfully")
  } catch (error) {
    next(error)
  }
}
const initBotHelpCenter = async (provider) => {
  try {
    console.log("Initialize bot help center, provider: ", provider);
    
    await MQService.consumeTask({
      queueName: `${Constants.QUEUE_NAME.HELP}`,
      onCallBackHandler: async (content, msg, channel) => {
        console.log("Thông tin từ", provider, "message received:", content);
      },
      msgAmount: 1,
      autoAck: false,
      requeue: false
    });
    
  } catch (error) {
    console.log("LỖI MQ", error.message);
    throw error;
  }
};

const initFacebookBot = async () => {
  try {
    await MQService.consumeTask({
      queueName: Constants.QUEUE_NAME.FACEBOOK,
      exchangeName: Constants.EXCHANGE.TOPIC,
      bindingKey: Constants.ROUTING_KEY.FACEBOOK_RECEIVE,
      exchangeType: 'topic',
      onCallBackHandler: async (content, msg, channel) => {
        console.log("Facebook message received:", content);
      },
      msgAmount: 1,
      autoAck: false,
      requeue: false
    });
  } catch (error) {
    throw error;
  }
};

const initZaloBot = async () => {
  try {
    await MQService.consumeTask({
      queueName: Constants.QUEUE_NAME.ZALO,
      exchangeName: Constants.EXCHANGE.TOPIC,
      bindingKey: Constants.ROUTING_KEY.ZALO_RECEIVE,
      exchangeType: 'topic',
      onCallBackHandler: async (content, msg, channel) => {
        console.log("Zalo message received:", content);
      },
      msgAmount: 1,
      autoAck: false,
      requeue: false
    });
  } catch (error) {
    throw error;
  }
};

const initWebBot = async () => {
  try {
    await MQService.consumeTask({
      queueName: Constants.QUEUE_NAME.WEB,
      exchangeName: Constants.EXCHANGE.TOPIC,
      bindingKey: Constants.ROUTING_KEY.WEB_RECEIVE,
      exchangeType: 'topic',
      onCallBackHandler: async (content, msg, channel) => {
        console.log("Web message received:", content);
      },
      msgAmount: 1,
      autoAck: false,
      requeue: false
    });
  } catch (error) {
    throw error;
  }
};
module.exports = { initFacebookBot, initZaloBot, initWebBot, initBotHelpCenter, disableChat,sendMessage, enableChat, sendMessageOnPlatform, updateAISetting, getAISetting };

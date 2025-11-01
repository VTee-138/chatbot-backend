const {Redis} = require('ioredis')
const config = require('./index')
console.log(config.REDIS_MQ_HOST)
const redisMQ = new Redis({
    host: config.REDIS_MQ_HOST,
    port: config.REDIS_MQ_PORT,
    password: config.REDIS_MQ_PASS,
})
module.exports = redisMQ
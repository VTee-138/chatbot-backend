const redis = require('../config/redis')
const mail = require('../config/mail')
async function checkRedis() {
    try {
        await redis.set("healthcheck", "ok", "EX", 5); // TTL 5s
        const value = await redis.get("healthcheck");
        console.log("📦 Redis test value:", value);
        return true;
    } catch (err) {
        console.error("❌ Redis test failed:", err);
        return false;
    }
}
async function checkNodeMailer(){
    mail.verify((error, success) => {
        if (error){
            console.error('❌ Lỗi SMTP', error.message)
        }
        else console.log('✅ SMTP sẵn sàng gửi mail')
    })
}

module.exports = { checkRedis, checkNodeMailer}
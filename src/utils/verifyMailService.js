const redis = require("../config/redis")
const { verifyToken } = require("./jwt")

class verifyMailService{
    verifyForgotMail = async (jwt) =>{
        const { email, shield } = verifyToken(jwt,'validate')
        const shieldChecker = await redis.get(`shield:${email}`)
        if (!shieldChecker || shield !== shieldChecker) throw new Error("TOKEN NÀY KHÔNG PHẢI CỦA BACKEND")
        const payload = { emal: email }
        await redis.del(`shield:${email}`)
        return payload
    }
    verifyRegisterMail = async (jwt) =>{
        try {
            const { email, shield } = verifyToken(jwt,'validate')
            const shieldChecker = await redis.get(`shield:${email}`)
            if (!shieldChecker || shield !== shieldChecker) throw new Error("TOKEN NÀY KHÔNG PHẢI CỦA BACKEND")
            await redis.del(`shield:${email}`)
            const hash = await redis.get(`hash:${email}`)
            console.log(hash)
            const payload = {passwordHash: hash, email: email}
            await redis.del(`hash:${payload.email}`) // Dọn redis ngay lập tức
            return payload
        } catch (error) {
            console.error(error)
        }
    }
}
module.exports = new verifyMailService()
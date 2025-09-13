const redis = require("../config/redis")
const { Constants } = require("./constant")
const { errorResponse, successResponse, catchAsync } = require("./response")
/**
 * @description Để tránh người dùng request quá nhiều tới dịch vụ register hoặc forgot mặc
 * dù email xác nhận vẫn còn hiệu lực, bằng cách check xem liệu key của type có
 * còn tồn tại trong redis hay không. 
 * 
 * - Nếu có, tức là mail vẫn còn thời hạn
 * - Nếu không, tức là mail đã hết hạn tiếp tục cho người dùng request gmail
 * @param {String} type có thể là register hoặc là forgot
 * @returns 
 */
const redisValidate = (type) =>{
    return async (req, res, next) => {
        try {
            const email = req.body?.email
            if (!email) {
                return errorResponse(res, "Thiếu email", 400)
            }
            const value = await redis.get(`${type}:${email}`)
            if (value) return errorResponse( res, "Vui lòng kiểm tra mail xác nhận để kích hoạt tài khoản!", Constants.OK)
            return next()
        }
        catch (err) {
            console.error("Redis validate error:", err)
            return errorResponse(res, "Có lỗi xảy ra", 500)
        }
    }
}

const validateForgotAccount = catchAsync( )
module.exports = {redisValidate}
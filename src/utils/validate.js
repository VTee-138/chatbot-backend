const redis = require("../config/redis")
const { Constants } = require("./constant")
const { errorResponse, successResponse } = require("./response")
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
    return async (res, req, next) => {
        const key = req.body
        const value = await redis.get(`${type}:${key.email}`)
        if (value) return errorResponse(res, "Vui lòng kiểm tra mail xác nhận để kích hoạt tài khoản!", Constants.OK)
        return next()
    }
}
module.exports = {redisValidate}
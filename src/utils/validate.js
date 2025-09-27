const redis = require("../config/redis")
const { Constants, ErrorResponse } = require("./constant");
const { EmailTypeList } = require("./mailConverter");
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
const redisValidate = (type, keyGetter) =>{
     return async (req, res, next) => {
        try {
            const data = typeof keyGetter === "function" ? keyGetter(req) : keyGetter;
            if (!data) {
                throw new ErrorResponse(res, Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED);
            }
            const value = await redis.get(`${type}:${data}`);
            if (value && EmailTypeList.includes(type)) {
                return errorResponse(res, "Vui lòng kiểm tra mail xác nhận để kích hoạt tài khoản!", Constants.BAD_REQUEST);
            }
            else if (value) return errorResponse(res, "BAD REQUESTS!", Constants.BAD_REQUEST);
            return next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = {redisValidate}
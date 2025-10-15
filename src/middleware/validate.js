const redis = require("../config/redis")
const { Constants, ErrorResponse } = require("../utils/constant");
const { EmailTypeList } = require("../utils/mailConverter");
const { errorResponse } = require("../utils/response")

const schemaValidate = (schema, type) => {
    return (req, res, next) => {
        let error;
        let value;
        if (type === "params") {
            ({ error, value } = schema.validate(req.params, { abortEarly: false }));
            if (!error) {
                req.params = value;
            }
        } else if (type === "query") {
            ({ error, value } = schema.validate(req.query, { abortEarly: false }));
            if (!error) {
                req.query = value;
            }
        }
        else if (type === "body") {
            ({ error, value } = schema.validate(req.body, { abortEarly: false }));
            if (!error) {
                req.body = value;
            }
        }
        else {
            throw new Error("Invalid validation type");
        }
        if (error) {
            return next(error); // return ở đây để chặn controller
        }

        next(); // chỉ chạy khi không có lỗi
    };
};


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
const redisValidate = (type, keyGetter) => {
    return async (req, res, next) => {
        try {
            const typeValue = typeof type === "function" ? req.params.type : type;
            const data = typeof keyGetter === "function" ? keyGetter(req) : keyGetter;
            if (!data) {
                throw new ErrorResponse(res, Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED);
            }
            const value = await redis.get(`${typeValue}:${data}`);
            if (value && EmailTypeList.includes(typeValue)) {
                return errorResponse(res, "Vui lòng kiểm tra mail xác nhận để kích hoạt tài khoản!", Constants.BAD_REQUEST);
            }
            else if (value) return errorResponse(res, "BAD REQUESTS!", Constants.BAD_REQUEST);
            return next();
        } catch (err) {
            next(err);
        }
    };
}


module.exports = { schemaValidate, redisValidate };

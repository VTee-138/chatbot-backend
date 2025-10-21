class Constants {
    static ADMIN_ROLE = 1;
    static USER_ROLE = 0;
    static OK = 200;
    static NO_CONTENT = 204;
    static CREATED = 201;
    static UNAUTHORIZED = 401;
    static BAD_REQUEST = 400;
    static FORBIDDEN = 403;
    static NOT_FOUND = 404;
    static CONFLICT = 409;
    static GATEWAY_TIMEOUT = 504;
    static TOO_MANY_REQUESTS = 429;
    static INTERNAL_SERVER_ERROR = 500;
    static EXPIRESIN = "72h";
    static AUTH_USERNAME = ".....";
    static AUTH_PASSWORD = ".....";
    static JWT_SECRET = ".....";
    static SECRET_KEY = ".....";
    static ACCESS_PUBLIC = "PUBLIC";
    static ACCESS_PRIVATE = "PRIVATE";
    static SESSION_NAME = "sid";
    static TIME_PICKER = {
        _30min: 30 * 60,
        _15min: 15 * 60,
        _1day: 60 * 60 * 24,
        _7day_ms: 7 * 60 * 60 * 24 * 1000,
        _7day_secs: 7 * 60 * 60 * 24,
        _1hour_ms: 60 * 60 * 1000,
        _120secs: 120
    };
    static MESSAGES = {
        _UNAUTHORIZED: "User not available",
        _TOKEN_INVALID: "Token invalid"
    }
    static ZALO = {
        GET_TOKEN_URL: 'https://oauth.zaloapp.com/v4/oa/access_token'
    }
    static STANDARD_AGE_FOR_TOKEN = 5 * 60 * 60;
    static LOCK_KEY_PREFIX = 'lock:zalo_refresh:';
    static LOCK_TTL_MS = 8_000; // TTL khóa (ms)
    static POLL_INTERVAL_MS = 300; // khi không có lock, chờ poll DB
    static POLL_MAX_ATTEMPTS = 8; // tối đa chờ

}
/**
 * Custom Error class dùng để chuẩn hóa lỗi trong hệ thống.
 *
 * ✅ Khi nào dùng?
 * - Dùng để throw ra lỗi có kiểm soát (operational error) trong Controller, Service hoặc Model.
 * - Ví dụ: User không tồn tại, email đã bị trùng, quyền truy cập bị từ chối...
 *
 * 🛠 Cách hoạt động:
 * - Kế thừa từ class Error chuẩn của JS.
 * - Có thêm thuộc tính `status` để xác định HTTP status code.
 * - Có thể kết hợp với errorHandler middleware để trả response chuẩn cho client.
 *
 * ⚠️ Lưu ý:
 * - Chỉ dùng cho lỗi "dự đoán trước" (operational error).
 * - Với lỗi hệ thống (bug, exception bất ngờ), nên để errorHandler bắt và xử lý riêng.
 */
class ErrorResponse extends Error {
    constructor(message, statusCode, errors = [], isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors; // useful cho validation
        this.isOperational = isOperational; // để phân biệt lỗi nào nên trả chi tiết người dùng và lỗi nào không trả ra 
        Object.setPrototypeOf(this, new.target.prototype)
        Error.captureStackTrace(this, this.constructor);
    }
}

function getProviderAppKey(provider) {
    switch (provider) {
        case 'zalo':
            return {
                appId: process.env.ZALO_APP_ID, appSecret: process.env.ZALO_APP_SECRET
            }
            break;

        default:
            return {
                appId: null, appSecret: null
            }
            break;
    }
}
module.exports = {
    Constants,
    ErrorResponse,
    getProviderAppKey
};

class Constants {
    static ADMIN_ROLE = 1;
    static USER_ROLE = 0;
    static OK = 200;
    static NO_CONTENT = 204;
    static CREATED = 201;
    static UNAUTHORIZED = 401;
    static BAD_REQUEST = 400;
    static FORBIDDEN = 403;
    static NOT_FOUND = 400;
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
        _15min: 15 * 60
    };
}

class ErrorResponse extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

module.exports = {
    Constants,
    ErrorResponse
};

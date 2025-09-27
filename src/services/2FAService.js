const { authenticator } = require("otplib");
const { comparePassword, hashPassword, generateApiKey } = require("../utils/crypto");

class TwoFAService{
    constructor(issuer = 'Heki Chat') {
        this.issuer = issuer; // tên ứng dụng hiển thị trong Authenticator
    }
    /**
    *Tạo secret cho user mới
    *@returns {string} secret base32
    */
    generateSecret() {
        return authenticator.generateSecret();
    }
    /**
    *Tạo OTP từ secret => Dùng cho việc test và debug
    *@param {string} secret
    *@returns {string} mã OTP (6 digits)
    */
    generateOTP(secret) {
        return authenticator.generate(secret);
    }
    /**
    *Tạo URI chuẩn otpauth://
    *@param {string} accountName - username của user
    *@param {string} secret
    *@returns {string} otpauth URI
    */
    generateOTPURI(accountName, secret) {
        return authenticator.keyuri(accountName, this.issuer, secret);
    }
    /**
    *Xác thực OTP
    *@param {string} token - mã OTP user nhập
    *@param {string} secret - secret trong DB
    *@returns {boolean}
   */
    verifyOTP(token, secret) {
        return authenticator.verify({ token, secret });
    }
    async verifyBackupCode(inputCode, storedHashes){
        for (const hash of storedHashes){
            if (await comparePassword(inputCode, hash)) return true
        }
        return false
    }
    // Tạo 8 mã backup cho người dùng, utility 1 lần
    generateBackupCodes(count = 8){
        const codes = [];
        for (let i = 0; i < count; i++) {
            const code = generateApiKey(8).toUpperCase(); // ví dụ 8 ký tự hex
            codes.push(code);
        }
        return codes
    }
    // hash 8 mã backup lại và lưu trong database
    async hashBackupCodes(codes) {
        return Promise.all(codes.map( code => hashPassword(code)));
    }
    async removeUsedBackupCode(token, hashedCodes) {
        const remains = [];
        for (const hash of hashedCodes) {
            const isMatch = await comparePassword(token, hash);
            if (!isMatch) remains.push(hash);
        }
        return remains;
    }
}
module.exports = new TwoFAService
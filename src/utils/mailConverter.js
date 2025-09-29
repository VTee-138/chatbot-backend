/**
 * Tạo ra link xác thực cho để cho người dùng validate
 * @param {String} code Mã token nằm ở cuối dành cho user
 * @param {EmailType} type Loại email được gửi đến cho người dùng
 * @param {String} domain Domain của FE, dể khi redirect về đó thì FE sẽ gửi được thông tin cho BE
 * 
 * @return {String} là link được gửi đính kèm trong email để người dùng valdiate
 * 
 * @example
 * //Send link forgot
 * linkVerifyingToSend('abc', EmailType.FORGOT, 'http://localhost:3000') => "http://localhost:3000/reset-password?token=abc"
 * //Send link register
 * linkVerifyingToSend('xyz', EmailType.REGISTER, 'http://localhost:3000') => "http://localhost:3000/verify-email?token=xyz"
 */
const linkVerifyingToSend = (code, type, domain) => {
    const baseUrl = domain || 'http://localhost:3000';
    
    switch (type) {
        case EmailType.FORGOT:
            return `${baseUrl}/quen-mat-khau/dat-lai-mat-khau?token=${code}`;
        case EmailType.REGISTER:
            return `${baseUrl}/verify-email?token=${code}`;
        case EmailType.MFA:
            return `${baseUrl}/verify-2fa?token=${code}`;
        default:
            return `${baseUrl}/verify?token=${code}`;
    }
}

// HTML DESIGN
// Lưu ý những file HTML chỉ nên có mỗi 
const htmlRegisterVerifiedLink = (link, user_email) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8f5ff; border-radius: 10px;">
        <h2 style="color: purple; margin-bottom: 10px;">Xin chào, ${user_email.split('@')[0]} 👋</h2>
        <p style="font-size: 16px; color: #333;">
            Bạn vừa yêu cầu <strong>xác thực tài khoản mới</strong> cho tài khoản của mình.
            Nhấn vào liên kết bên dưới để tiếp tục quá trình:
        </p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="${link}" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Xác Thực Tài Khoản</a>
        </div>
        <p style="font-size: 12px; color: #888; margin-top: 10px;">
            Hoặc copy link này: <span style="color: #7C3AED; word-break: break-all;">${link}</span>
        </p>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Mã có hiệu lực trong 40 giây. Đừng chia sẻ mã này với bất kỳ ai.
        </p>
    </div>`
const htmlForgotVerifiedLink = (link, user_email) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8f5ff; border-radius: 10px;">
        <h2 style="color: purple; margin-bottom: 10px;">Xin chào, ${user_email.split('@')[0]} 👋</h2>
        <p style="font-size: 16px; color: #333;">
        Bạn vừa yêu cầu <strong>đặt lại mật khẩu</strong> cho tài khoản của mình.
        Nhấn vào liên kết bên dưới để tiếp tục quá trình:
        </p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="${link}" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Đặt Lại Mật Khẩu</a>
        </div>
        <p style="font-size: 12px; color: #888; margin-top: 10px;">
            Hoặc copy link này: <span style="color: #DC2626; word-break: break-all;">${link}</span>
        </p>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Liên kết này có hiệu lực trong 40 giây. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
        </p>
    </div>
`;

/**
 * Bộ hàm chuyển đổi sang HTML Content để gửi mail.
 * Sau khi developer tạo ra các hàm HTML content riêng (vd: htmlForgotVerifiedLink, htmlRegisterVerifiedLink),
 * có thể thêm vào đây để tái sử dụng dễ dàng.
 * @typedef {Object} HtmlConverter
 * @property {function(string, string): string} Forgot - Tạo HTML content verify code cho quên mật khẩu.
 * @property {function(string, string): string} Register - Tạo HTML content verify code cho đăng ký tài khoản.
 */
/** @type {HtmlConverter} */
const HtmlConverter = {
    Forgot: htmlForgotVerifiedLink,
    Register: htmlRegisterVerifiedLink,
    
};
/**
 * @typedef {Object} EmailType
 * @property {string} REGISTER - dùng cho việc gửi code đăng ký tới email người dùng
 * @property {string} FORGOT - dùng cho việc gửi thông code quên mật khẩu tới email người dùng
 */
/** @type {EmailType} */
const EmailType = {
    REGISTER : 'register',
    FORGOT : 'forgot',
    MFA: "2fa"
}
const EmailTypeList = ['register', 'forgot', '2fa']

module.exports = { EmailTypeList, EmailType, HtmlConverter, htmlForgotVerifiedLink, htmlRegisterVerifiedLink, linkVerifyingToSend}
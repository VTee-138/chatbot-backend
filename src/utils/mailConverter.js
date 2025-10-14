/**
 * Tạo ra link xác thực cho để cho người dùng validate
 * @param {String} domain Domain của FE, dể khi redirect về đó thì FE sẽ gửi được thông tin cho BE
 * @param {EmailType} type Loại email được gửi đến cho người dùng
 * @param {String} code Mã token nằm ở cuối dành cho user
 * 
 * @return {String} là link được gửi đính kèm trong email để người dùng valdiate
 * 
 * @example
 * //Send link forgot
 * linkVerifyingToSend('abc', EmailType.FORGOT, 'chatgpt.com') => "https://chatgpt.com=/forgot/auth/abc"
 */
const linkVerifyingToSend = (code, type, domain) => `https://${domain}/${type}/auth/code=${code}`

// HTML DESIGN
// Lưu ý những file HTML chỉ nên có mỗi 
const htmlRegisterVerifiedLink = (link, user_email) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8f5ff; border-radius: 10px;">
        <h2 style="color: purple; margin-bottom: 10px;">Xin chào, ${user_email.split('@')[0]} 👋</h2>
        <p style="font-size: 16px; color: #333;">
            Bạn vừa yêu cầu <strong>xác thực tài khoản mới</strong> cho tài khoản của mình.
            Nhấn vào nút bên dưới để tiếp tục quá trình:
        </p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="${link}" style="background-color: purple; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block;">Xác nhận tài khoản</a>
        </div>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Liên kết này có hiệu lực trong 1 giờ. Đừng chia sẻ nó với bất kỳ ai.
        </p>
    </div>`
const htmlForgotVerifiedLink = (link, user_email) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8f5ff; border-radius: 10px;">
    <h2 style="color: purple; margin-bottom: 10px;">Xin chào, ${user_email.split('@')[0]} 👋</h2>
    <p style="font-size: 16px; color: #333;">
        Bạn vừa yêu cầu <strong>quên mật khẩu</strong> cho tài khoản của mình.
        Nhấn vào nút bên dưới để cài đặt lại mật khẩu:
    </p>
    <div style="text-align: center; margin: 20px 0;">
        <a href="${link}" style="background-color: purple; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block;">Cài đặt lại mật khẩu</a>
    </div>
    <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Liên kết này có hiệu lực trong 1 giờ. Đừng chia sẻ nó với bất kỳ ai.
    </p>
    </div>
`;

const htmlGroupInvitation = (link, user_email) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8f5ff; border-radius: 10px;">
        <h2 style="color: purple; margin-bottom: 10px;">Xin chào, ${user_email.split('@')[0]} 👋</h2>
        <p style="font-size: 16px; color: #333;">
            Bạn đã được mời tham gia vào một nhóm.
            Nhấn vào liên kết bên dưới để chấp nhận lời mời:
        </p>
        <div style="padding: 5px 5px; background: white; color: #fff; display: inline-block; border-radius: 10px; font-size: 16px; letter-spacing: 2px;">
        <a href="${link}" style="color:purple;text-decoration:none;">Accept Invitation</a>
        </div>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Liên kết này có hiệu lực trong 7 ngày. Nếu bạn không mong muốn tham gia, vui lòng bỏ qua email này.
        </p>
    </div>`;

/**
 * Bộ hàm chuyển đổi sang HTML Content để gửi mail.
 * Sau khi developer tạo ra các hàm HTML content riêng (vd: htmlForgotVerifiedLink, htmlRegisterVerifiedLink),
 * có thể thêm vào đây để tái sử dụng dễ dàng.
 * @typedef {Object} HtmlConverter
 * @property {function(string, string): string} Forgot - Tạo HTML content verify code cho quên mật khẩu.
 * @property {function(string, string): string} Register - Tạo HTML content verify code cho đăng ký tài khoản.
 * @property {function(string, string): string} GroupInvitation - Tạo HTML content cho lời mời tham gia nhóm.
 */
/** @type {HtmlConverter} */
const HtmlConverter = {
    Forgot: htmlForgotVerifiedLink,
    Register: htmlRegisterVerifiedLink,
    GroupInvitation: htmlGroupInvitation
};
/**
 * @typedef {Object} EmailType
 * @property {string} REGISTER - dùng cho việc gửi code đăng ký tới email người dùng
 * @property {string} FORGOT - dùng cho việc gửi thông code quên mật khẩu tới email người dùng
 * @property {string} GROUP_INVITATION - dùng cho việc gửi email mời tham gia nhóm
 */
/** @type {EmailType} */
const EmailType = {
    REGISTER : 'register',
    FORGOT : 'forgot',
    MFA: "2fa",
    GROUP_INVITATION: 'group_invitation'
}
const EmailTypeList = ['register', 'forgot', '2fa', 'group_invitation']

module.exports = { EmailTypeList, EmailType, HtmlConverter, htmlForgotVerifiedLink, htmlRegisterVerifiedLink, linkVerifyingToSend, htmlGroupInvitation}

// import { mailLimiter } from "../utils/rate_limit_prevent.js"; // Sẽ nghiên cứu tiếp xem có quan trọng không
const mail = require('../config/mail.js')
const {linkVerifyingToSend} = require('../utils/mailConverter.js')
/**
 * 
 * Sử dụng cho việc liên quan đến verify như register, forgot, v.v...
 * @param {EmailType} type - Dùng để phân loại email
 * @param {string} domain - Dùng để tạo ra link để gửi email
 * @param {string} code - code dùng để verify người dùng
 * @param {string} email - email của người dùng
 * @param {string} subject - Tiêu để của email
 * @param {HtmlConverter} htmlConverter - Dùng để convert chuẩn loại HTML Content trước khi gửi cho người dùng
 */
const sendEmailToVerify  = async (type, domain, code, email, subject, htmlConverter) => {
    try {
        const link = linkVerifyingToSend(code, type, domain)
        const htmlContent = htmlConverter(link, email)
        await sendEmail(mail, email, subject, link, htmlContent)    
    } catch (error) {
        console.error('Lỗi Mail Service: ', error)
        throw new Error("Error Mail Service: ", error);
    }
}

/**
 * Gửi email qua SMTP bằng Nodemailer.
 *
 * @param {import('nodemailer').Transporter} transporter - Đối tượng transporter đã cấu hình.
 * @param {string} to - Địa chỉ email người nhận.
 * @param {string} subject - Tiêu đề email.
 * @param {string} text - Nội dung dạng text thuần.
 * @param {string} html - Nội dung dạng HTML.
 * @returns {Promise<void>} - Trả về Promise khi quá trình gửi hoàn tất.
 */
const sendEmail = async(transporter, to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"TinZ Validator 👋" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html
        });
        console.log("✅ Email đã gửi:", info.messageId);
        console.log("✅ Đã gửi email đến", to, "lúc", new Date().toLocaleTimeString());
    } catch (error) {
        console.error("❌ Lỗi gửi email:", error);
        throw new Error(error);
    }
};
module.exports = {sendEmail, sendEmailToVerify}
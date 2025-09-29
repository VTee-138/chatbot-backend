
// import { mailLimiter } from "../utils/rate_limit_prevent.js"; // Sẽ nghiên cứu tiếp xem có quan trọng không
const config = require('../config')
const {linkVerifyingToSend} = require('../utils/mailConverter.js')

// Dynamic mail transport selection with fallback
const getMailTransporter = () => {
    // Check if we have proper mail credentials
    const hasMailCredentials = config.USER_MAIL && config.APP_PASSWORD;
    
    // Force mock mail if no credentials or if SMTP is failing
    if (!hasMailCredentials) {
        console.log('🔧 Using mock mail service (missing credentials)');
        return require('../config/mail-mock');
    }
    
    // Try to use real SMTP, but will fallback to mock on error
    console.log('📧 Attempting to use real SMTP mail service');
    return require('../config/mail');
}

const mail = getMailTransporter()
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
    const link = linkVerifyingToSend(code, type, domain) 
    const htmlContent = htmlConverter(link, email)
    
    try {
        // Try primary mail service
        await sendEmail(mail, email, subject, link, htmlContent, 1) // 1 retry only
        console.log('✅ Email sent successfully with primary configuration');
        return;
    } catch (primaryError) {
        console.error('❌ Primary mail service failed:', primaryError.message);
        
        // If SMTP timeout, try alternative configurations
        if (primaryError.message.includes('ETIMEDOUT') || primaryError.message.includes('ESOCKET')) {
            console.log('🔄 SMTP timeout detected, trying alternative mail...');
            
            try {
                const alternativeMail = require('../config/mail-alternative');
                await sendEmail(alternativeMail, email, subject, link, htmlContent, 1);
                console.log('✅ Email sent successfully with alternative configuration');
                return;
            } catch (alternativeError) {
                console.error('❌ Alternative mail also failed:', alternativeError.message);
            }
        }
        
        // Final fallback: use mock mail for development
        if (config.NODE_ENV === 'development') {
            console.log('🔧 Using mock mail as final fallback in development');
            const mockMail = require('../config/mail-mock');
            await sendEmail(mockMail, email, subject, link, htmlContent, 1);
            console.log('✅ Mock email sent (development mode)');
            return;
        }
        
        // In production, still throw error after trying all options
        throw new Error(`All mail services failed. Primary: ${primaryError.message}`);
    }
}

/**
 * Gửi email qua SMTP bằng Nodemailer với retry logic.
 *
 * @param {import('nodemailer').Transporter} transporter - Đối tượng transporter đã cấu hình.
 * @param {string} to - Địa chỉ email người nhận.
 * @param {string} subject - Tiêu đề email.
 * @param {string} text - Nội dung dạng text thuần.
 * @param {string} html - Nội dung dạng HTML.
 * @returns {Promise<void>} - Trả về Promise khi quá trình gửi hoàn tất.
 */
const sendEmail = async(transporter, to, subject, text, html, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`📧 Attempting to send email (attempt ${attempt}/${retries}) to ${to}`);
            
            const info = await transporter.sendMail({
                from: `"TinZ Validator 👋" <${process.env.USER_MAIL}>`,
                to,
                subject,
                text,
                html
            });
            
            console.log("✅ Email đã gửi:", info.messageId);
            console.log("✅ Đã gửi email đến", to, "lúc", new Date().toLocaleTimeString());
            return; // Success, exit retry loop
            
        } catch (error) {
            console.error(`❌ Lỗi gửi email (attempt ${attempt}/${retries}):`, error.message);
            
            if (attempt === retries) {
                // Last attempt failed, throw error
                throw new Error(`Failed to send email after ${retries} attempts: ${error.message}`);
            }
            
            // Wait before retry (exponential backoff)
            const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
            console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};
module.exports = {sendEmail, sendEmailToVerify}
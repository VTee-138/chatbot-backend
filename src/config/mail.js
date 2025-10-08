const config = require('./index')
const nodemailer = require('nodemailer')

const mail = nodemailer.createTransport({
    host: "smtp.gmail.com",
    service: "gmail",
    port: 465,
    secure: true,
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000,   // 30 seconds  
    socketTimeout: 60000,     // 60 seconds
    auth: {
        user: config.USER_MAIL,
        pass: config.APP_PASSWORD
    }
})

// Verify connection configuration
mail.verify(function(error, success) {
    if (error) {
        console.error('❌ SMTP connection error:', error);
    } else {
        console.log('✅ SMTP connection is ready');
    }
});

module.exports = mail
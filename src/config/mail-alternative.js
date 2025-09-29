const config = require('./index')
const nodemailer = require('nodemailer')

// Primary configuration (port 465)
const mailPrimary = nodemailer.createTransporter({
    host: "smtp.gmail.com",
    service: "gmail", 
    port: 465,
    secure: true,
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    auth: {
        user: config.USER_MAIL,
        pass: config.APP_PASSWORD
    }
})

// Alternative configuration (port 587) 
const mailAlternative = nodemailer.createTransporter({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use STARTTLS
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    auth: {
        user: config.USER_MAIL,
        pass: config.APP_PASSWORD
    },
    tls: {
        rejectUnauthorized: false // Accept self-signed certificates
    }
})

// Function to test and return working transporter
const getWorkingTransporter = async () => {
    // Try primary first
    try {
        await new Promise((resolve, reject) => {
            mailPrimary.verify((error, success) => {
                if (error) reject(error);
                else resolve(success);
            });
        });
        console.log('✅ Primary SMTP (port 465) connection successful');
        return mailPrimary;
    } catch (error) {
        console.log('⚠️ Primary SMTP (port 465) failed, trying alternative...');
    }

    // Try alternative
    try {
        await new Promise((resolve, reject) => {
            mailAlternative.verify((error, success) => {
                if (error) reject(error);
                else resolve(success);
            });
        });
        console.log('✅ Alternative SMTP (port 587) connection successful');
        return mailAlternative;
    } catch (error) {
        console.error('❌ Both SMTP configurations failed');
        throw error;
    }
}

// Export the working transporter
let workingTransporter = null;

const mail = {
    async sendMail(mailOptions) {
        if (!workingTransporter) {
            workingTransporter = await getWorkingTransporter();
        }
        return workingTransporter.sendMail(mailOptions);
    },
    
    verify(callback) {
        if (workingTransporter) {
            return workingTransporter.verify(callback);
        }
        // Try to establish connection first
        getWorkingTransporter()
            .then(transporter => {
                workingTransporter = transporter;
                transporter.verify(callback);
            })
            .catch(error => callback(error));
    }
}

module.exports = mail
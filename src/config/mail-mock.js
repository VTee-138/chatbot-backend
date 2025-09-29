/**
 * Mock Mail Service for Development
 * Use this when SMTP is not available or for testing
 */

const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Mock transporter that logs emails instead of sending them
 */
const mockTransporter = {
    async sendMail(mailOptions) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: mailOptions.html,
            messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        // Log to console
        console.log('📧 Mock Email Sent:');
        console.log(`   To: ${mailOptions.to}`);
        console.log(`   Subject: ${mailOptions.subject}`);
        console.log(`   Message ID: ${logEntry.messageId}`);

        // Log to file
        const logFile = path.join(logsDir, `emails-${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + '\n---\n');

        // Return mock info object
        return {
            messageId: logEntry.messageId,
            response: '250 Mock email accepted',
            envelope: {
                from: mailOptions.from,
                to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to]
            }
        };
    },

    verify(callback) {
        console.log('✅ Mock SMTP verification successful');
        if (callback) callback(null, true);
        return Promise.resolve(true);
    }
};

module.exports = mockTransporter;
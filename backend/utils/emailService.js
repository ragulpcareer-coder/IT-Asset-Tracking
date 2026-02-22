const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // Standard configuration for demonstration/student projects
    auth: {
        user: process.env.EMAIL_USER || 'it.asset.tracker.alert@gmail.com', // Replace via ENV
        pass: process.env.EMAIL_PASS || 'placeholder_password',
    }
});

const sendSecurityAlert = async (subject, message) => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

        await transporter.sendMail({
            from: '"Asset Tracker Security" <alert@asset-tracker.local>',
            to: adminEmail,
            subject: `🚨 SECURITY ALERT: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ff0000; border-radius: 5px;">
                    <h2 style="color: #ff0000;">⚠️ Security Incident Detected</h2>
                    <p><strong>Event:</strong> ${subject}</p>
                    <p>${message}</p>
                    <hr/>
                    <p style="font-size: 12px; color: #666;">This is an automated message from the Cybersecurity Tracking System.</p>
                </div>
            `
        });
        console.log(`[Email Service] Sent alert: ${subject}`);
    } catch (err) {
        console.error('[Email Service] Failed to send email alert:', err.message);
    }
};

module.exports = {
    sendSecurityAlert
};

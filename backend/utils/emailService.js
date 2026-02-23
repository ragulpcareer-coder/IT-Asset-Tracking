const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    debug: true,
    logger: true
});

// Verify connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('[Email Service] Connection Error:', error);
    } else {
        console.log('[Email Service] SMTP connection established successfully');
    }
});

const sendSecurityAlert = async (subject, message) => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
        const sender = process.env.EMAIL_USER;

        if (!adminEmail || !sender) {
            console.error('[Email Service] Missing configuration: ADMIN_EMAIL or EMAIL_USER');
            return;
        }

        await transporter.sendMail({
            from: `"Asset Tracker Security" <${sender}>`,
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

const sendApprovalRequest = async (userInfo) => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
        const sender = process.env.EMAIL_USER;

        if (!adminEmail || !sender) {
            console.error('[Email Service] Missing configuration for approval request');
            return;
        }

        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

        const approveUrl = `${backendUrl}/api/auth/approve/${userInfo._id}`;
        const rejectUrl = `${backendUrl}/api/auth/reject/${userInfo._id}`;

        await transporter.sendMail({
            from: `"Asset Tracker Approval" <${sender}>`,
            to: adminEmail,
            subject: `📝 NEW USER REGISTRATION: ${userInfo.name}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #007bff; border-radius: 5px;">
                    <h2 style="color: #007bff;">New Account Request</h2>
                    <p>A new account has been requested. Please review the details below:</p>
                    <p><strong>Name:</strong> ${userInfo.name}</p>
                    <p><strong>Email:</strong> ${userInfo.email}</p>
                    <p><strong>Requested Role:</strong> ${userInfo.role}</p>
                    <hr/>
                    <p>Click below to approve or reject this account:</p>
                    <div style="margin-top: 20px;">
                        <a href="${approveUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">YES - Approve</a>
                        <a href="${rejectUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">NO - Reject</a>
                    </div>
                </div>
            `
        });
        console.log(`[Email Service] Sent approval request for: ${userInfo.email}`);
    } catch (err) {
        console.error('[Email Service] Failed to send approval request:', err.message);
    }
};

module.exports = {
    transporter,
    sendSecurityAlert,
    sendApprovalRequest
};

const nodemailer = require("nodemailer");
const { Resend } = require('resend');

// Initialize Resend if key exists
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Initialize Nodemailer for SMTP fallback (§Requirement 3.2 - Gmail/Outlook/Custom)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || 'ragulp.career@gmail.com',
        pass: process.env.EMAIL_PASS || 'fwyh rjqy lqve kldm', // Example App Password
    },
});

const fromEmail = process.env.EMAIL_FROM || 'AssetTracker <onboarding@resend.dev>';

const sendEmail = async ({ to, subject, html, reply_to }) => {
    try {
        // Try Resend first (Enterprise Standard)
        if (resend) {
            const { data, error } = await resend.emails.send({
                from: fromEmail,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                reply_to
            });
            if (error) throw new Error(`Resend Error: ${error.message}`);
            console.log(`[Email] Dispatched via Resend: ${data.id}`);
            return data;
        }

        // Fallback to Nodemailer/SMTP
        const info = await transporter.sendMail({
            from: fromEmail,
            to: Array.isArray(to) ? to : to,
            subject,
            html,
            replyTo: reply_to
        });
        console.log(`[Email] Dispatched via SMTP: ${info.messageId}`);
        return info;
    } catch (err) {
        console.error('[Email Service Error]', err.message);
        throw err;
    }
};

const sendSecurityAlert = async (subject, message) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'ragulp.career@gmail.com';
    await sendEmail({
        to: adminEmail,
        subject: `🚨 SECURITY ALERT: ${subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ff0000; border-radius: 5px;">
                <h2 style="color: #ff0000;">⚠️ Security Incident Detected</h2>
                <p><strong>Event:</strong> ${subject}</p>
                <p>${message}</p>
                <hr/>
                <p style="font-size: 12px; color: #666;">This is an automated message from the IT Asset Tracking SOC.</p>
            </div>
        `
    }).catch(err => console.error("Forensic log failure:", err.message));
};

const sendApprovalRequest = async (userInfo) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'ragulp.career@gmail.com';
    const backendUrl = process.env.BACKEND_URL || 'https://it-asset-tracking.onrender.com';
    const userId = userInfo._id.toString();

    return await sendEmail({
        to: adminEmail,
        reply_to: userInfo.email,
        subject: `📝 NEW USER REGISTRATION: ${userInfo.name}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #007bff; border-radius: 5px;">
                <h2>New Account Request</h2>
                <p><strong>Name:</strong> ${userInfo.name}</p>
                <p><strong>Email:</strong> ${userInfo.email}</p>
                <p><strong>Requested Role:</strong> ${userInfo.role}</p>
                <hr/>
                <p>Action Required:</p>
                <div style="margin-top: 20px;">
                    <a href="${backendUrl}/api/auth/approve/${userId}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Approve</a>
                    <a href="${backendUrl}/api/auth/reject/${userId}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reject</a>
                </div>
            </div>
        `
    });
};

const sendPasswordResetEmail = async (userInfo, resetToken) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    return await sendEmail({
        to: userInfo.email,
        subject: `🔐 PASSWORD RESET: Action Required`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #00d4ff; border-radius: 8px; max-width: 600px; margin: auto; background-color: #0d1117; color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #00d4ff;">Security Signature Verification</h2>
                </div>
                <p>Hello ${userInfo.name},</p>
                <p>A password reset has been requested for your account. Please use the secure link below to proceed with original credential rotation:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background: #00d4ff; color: #000000; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                        RESET PASSWORD
                    </a>
                </div>
                <p style="font-size: 13px; color: #8b949e;">This link will expire in 15 minutes. If you did not request this, please ignore this email.</p>
            </div>
        `
    });
};

module.exports = {
    resend,
    sendSecurityAlert,
    sendApprovalRequest,
    sendPasswordResetEmail
};


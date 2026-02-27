const nodemailer = require("nodemailer");
const { Resend } = require('resend');

// Initialize Resend (Optional Fallback)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Initialize Nodemailer with Gmail optimized settings (Requirement 2)
// Using Port 465 and Secure: true for maximum production reliability
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Port 587 uses STARTTLS
    auth: {
        user: process.env.EMAIL_USER || 'ragulp.career@gmail.com',
        pass: (process.env.EMAIL_PASS || 'fwyh rjqy lqve kldm').replace(/\s/g, ''),
    }
});

const fromEmail = process.env.EMAIL_FROM || 'IT Asset Tracker <ragulp.career@gmail.com>';

/**
 * Common dispatch engine with explicit logging (§Requirement 3 & 5)
 */
const sendEmail = async ({ to, subject, html, reply_to }) => {
    console.log(`[Email System] Initiating dispatch to: ${to}`);
    console.log(`[Email System] Subject: ${subject}`);

    try {
        // Attempt SMTP Transmission (Priority 1)
        console.log(`[SMTP] Contacting smtp.gmail.com:465...`);
        const info = await transporter.sendMail({
            from: fromEmail,
            to: Array.isArray(to) ? to.join(',') : to,
            subject,
            html,
            replyTo: reply_to
        });

        console.log(`[SMTP] SUCCESS: Email sent successfully!`);
        console.log(`[SMTP] ID: ${info.messageId}`);
        console.log(`[SMTP] Payload Status: ${info.response}`);
        return info;

    } catch (smtpError) {
        console.error(`[SMTP] CRITICAL FAILURE:`, smtpError.message);
        console.error(`[SMTP] Error Stack:`, smtpError.stack);

        // Fallback to Resend only if SMTP fails
        if (resend) {
            console.warn(`[Fallback] Attempting Resend API fallback...`);
            const { data, error } = await resend.emails.send({
                from: 'onboarding@resend.dev',
                to: Array.isArray(to) ? to : [to],
                subject: `(Fallback) ${subject}`,
                html,
                reply_to
            });
            if (error) {
                console.error(`[Fallback] Resend also failed: ${error.message}`);
                throw new Error(`Email Dispatch Exhausted: ${smtpError.message}`);
            }
            console.log(`[Fallback] Resend Success: ${data.id}`);
            return data;
        }

        // Propagate the error so the controller can inform the user (Requirement 4)
        throw smtpError;
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


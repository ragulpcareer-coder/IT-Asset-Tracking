const { Resend } = require('resend');

// Initialize Resend with API Key
const resend = new Resend(process.env.RESEND_API_KEY || 're_7AUPEm1L_BvDiR3ASjMgXyhtoveD9ACzY');

const sendSecurityAlert = async (subject, message) => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'ragulp.career@gmail.com';

        // Resend free tier requires sending from onboarding@resend.dev
        // unless you verify a custom domain.
        const fromEmail = 'AssetTracker <onboarding@resend.dev>';

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [adminEmail],
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

        if (error) {
            console.error('[Email Service] Resend Error:', error);
        } else {
            console.log('[Email Service] Sent alert via Resend:', data.id);
        }
    } catch (err) {
        console.error('[Email Service] Failed to send email alert:', err.message);
    }
};

const sendApprovalRequest = async (userInfo) => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'ragulp.career@gmail.com';
        const fromEmail = 'AssetTracker <onboarding@resend.dev>';
        const backendUrl = process.env.BACKEND_URL || 'https://it-asset-tracking.onrender.com';

        const userId = userInfo._id.toString();
        const approveUrl = `${backendUrl}/api/auth/approve/${userId}`;
        const rejectUrl = `${backendUrl}/api/auth/reject/${userId}`;

        console.log(`[Email Service] Sending registration email for UserID: ${userId}`);

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [adminEmail],
            reply_to: userInfo.email,
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

        if (error) throw new Error(error.message);
        return data;
    } catch (err) {
        console.error('[Email Service] Approval Failure:', err.message);
        throw err;
    }
};

const sendPasswordResetEmail = async (userInfo, resetToken) => {
    try {
        const fromEmail = 'AssetTracker <onboarding@resend.dev>';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

        console.log(`[Email Service] Sending password reset link to ${userInfo.email}`);

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [userInfo.email],
            subject: `🔐 PASSWORD RESET: Action Required`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #00d4ff; border-radius: 8px; max-width: 600px; margin: auto; background-color: #0a1128; color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #00d4ff; margin-bottom: 5px;">Security Update</h2>
                        <p style="color: #64748b; font-size: 14px;">IT Asset Tracking System</p>
                    </div>
                    <p>Hello <strong>${userInfo.name}</strong>,</p>
                    <p>We received a request to reset your master account password. To proceed, please click the secure button below:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background: linear-gradient(90deg, #00d4ff, #6432ff); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);">
                            Reset Password
                        </a>
                    </div>
                    <p style="font-size: 13px; color: #94a3b8;">This link will expire in <strong>15 minutes</strong> for security compliance. If you did not request this, please secure your account immediately or notify the SOC team.</p>
                    <hr style="border: none; border-top: 1px solid #334155; margin: 20px 0;"/>
                    <p style="font-size: 11px; color: #64748b; text-align: center;">This is an automated security transmission. Do not reply.</p>
                </div>
            `
        });

        if (error) throw new Error(error.message);
        return data;
    } catch (err) {
        console.error('[Email Service] Reset Failure:', err.message);
        throw err;
    }
};

module.exports = {
    resend,
    sendSecurityAlert,
    sendApprovalRequest,
    sendPasswordResetEmail
};


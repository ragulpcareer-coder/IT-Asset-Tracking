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

        const approveUrl = `${backendUrl}/api/auth/approve/${userInfo._id}`;
        const rejectUrl = `${backendUrl}/api/auth/reject/${userInfo._id}`;

        console.log(`[Email Service] Attempting to send approval request for ${userInfo.email} to ${adminEmail}`);

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

        if (error) {
            console.error('[Email Service] Resend API Error:', error);
            throw new Error(`Resend Error: ${error.message}`);
        } else {
            console.log('[Email Service] Successfully sent approval request. ID:', data.id);
            return data;
        }
    } catch (err) {
        console.error('[Email Service] Critical Failure:', err.message);
        throw err;
    }
};

module.exports = {
    resend, // Exporting the instance for the diagnostic route
    sendSecurityAlert,
    sendApprovalRequest
};

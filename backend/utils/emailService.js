const nodemailer = require("nodemailer");
const { Resend } = require('resend');

// Initialize Resend (Optional Fallback)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Initialize Nodemailer with Gmail optimized settings (Production Grade: Port 465)
// REQUIREMENT: Use Port 465 + SSL (secure: true) for cloud reliability
// Initialize Transporter with Render-optimized IPv4 settings
// FIX: Force IPv4 (family: 4) to bypass ENETUNREACH IPv6 routing deadlock on Render
// FIX: Force IPv4 (family: 4) to bypass ENETUNREACH IPv6 routing deadlock on Render
// Primary Strategy: Port 465 (SSL/TLS) for reliability
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,          // true for 465
    family: 4,             // ðŸ”¥ FORCE IPv4
    auth: {
        user: process.env.EMAIL_USER,
        pass: (process.env.EMAIL_PASS || '').replace(/\s/g, ''),
    },
    tls: {
        rejectUnauthorized: false,
    },
});

// Fallback Strategy: Port 587 (STARTTLS)
const fallbackTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,
    auth: {
        user: process.env.EMAIL_USER,
        pass: (process.env.EMAIL_PASS || '').replace(/\s/g, ''),
    },
    tls: {
        rejectUnauthorized: false,
    }
});

// Pre-flight connection verification (Non-blocking bootstrap)
try {
    transporter.verify((error, success) => {
        if (error) {
            console.warn(`[SMTP-Diagnostic] Port 587/465 unreachable (Expected on some Cloud Hosts). Error: ${error.message}`);
            console.log(`[SMTP-Diagnostic] SYSTEM_INFO: Defaulting to P1: Resend (HTTPS) for production reliability.`);
        } else {
            console.log("SMTP SERVER READY");
        }
    });
} catch (vErr) {
    console.error(`[SMTP-Diagnostic] Critical Verify Exception:`, vErr.message);
}

const fromEmail = process.env.EMAIL_FROM || 'IT Asset Tracker <ragulp.career@gmail.com>';
const resendFrom = (process.env.RESEND_FROM_EMAIL || "").trim();
const resendSandboxSender = "onboarding@resend.dev";

const parseRecipientList = (value = "") =>
    String(value)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

const normalizeRecipientEmails = (to) =>
    (Array.isArray(to) ? to : [to])
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean);

const defaultSandboxRecipients = parseRecipientList([
    process.env.ADMIN_EMAIL,
    process.env.EMAIL_USER
].filter(Boolean).join(","));

const configuredSandboxRecipients = parseRecipientList(process.env.RESEND_SANDBOX_RECIPIENTS || "");
const allowedSandboxRecipients = new Set([
    ...defaultSandboxRecipients,
    ...configuredSandboxRecipients
]);
const normalizeBaseUrl = (value) => {
    if (!value || typeof value !== "string") return "";
    return value.trim().replace(/\/+$/, "");
};

const resolveFrontendUrl = () => {
    const configured = [
        process.env.FRONTEND_URL,
        process.env.PUBLIC_FRONTEND_URL,
        process.env.CLIENT_URL,
        process.env.APP_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ].map(normalizeBaseUrl).filter(Boolean);

    const canonical = "https://it-asset-tracking.vercel.app";
    const preferred = configured[0] || canonical;

    // Never send password reset links to preview/stale Vercel deployments.
    // Allow canonical production, localhost (dev), or explicit non-vercel custom domain.
    const isPreviewVercel = /\.vercel\.app$/i.test(preferred) && !/https:\/\/it-asset-tracking\.vercel\.app$/i.test(preferred);
    if (isPreviewVercel) return canonical;

    return preferred;
};

/**
 * Common dispatch engine with forensic logging
 */
const sendEmail = async ({ to, subject, html, reply_to }) => {
    const isProd = process.env.NODE_ENV === 'production';
    console.log(`[Email Engine] Forensic Dispatch Start: to=${to} (Env: ${process.env.NODE_ENV})`);
    const recipients = normalizeRecipientEmails(to);

    // Strategy 1: Resend (HTTPS API) - The Production Gold Standard
    if (resend) {
        try {
            console.log(`[Email Engine] P1: Attempting Resend API...`);

            // Prefer explicitly configured verified sender for Resend in production.
            // Fallback to sandbox sender only when configured sender is unavailable.
            const sender = resendFrom || (!fromEmail.includes("gmail.com") ? fromEmail : resendSandboxSender);
            const usingSandbox = sender === resendSandboxSender;
            const sandboxRecipientAllowed = !usingSandbox || recipients.every((email) => allowedSandboxRecipients.has(email));

            console.log(`[Email Engine] Identity: Sending as ${sender}`);

            if (!sandboxRecipientAllowed) {
                console.warn("[Email Engine] Resend sandbox sender blocked for this recipient set. Falling back to SMTP.");
            } else {
                const { data, error } = await resend.emails.send({
                    from: sender,
                    to: Array.isArray(to) ? to : [to],
                    subject: usingSandbox ? `[IT-ASSET-SYSTEM] ${subject}` : subject,
                    html,
                    reply_to
                });

                if (error) {
                    console.error(`[Email Engine] RESEND REJECTED (Code: ${error.name}): ${error.message}`);
                    // Don't throw yet, try SMTP if we are allowed
                } else {
                    console.log(`[Email Engine] RESEND SUCCESS: ID: ${data.id}`);
                    return { ...data, provider: "resend" };
                }
            }
        } catch (resendErr) {
            console.error(`[Email Engine] RESEND CRITICAL EXCEPTION:`, resendErr.message);
        }
    }

    // Strategy 2: SMTP Relay (Gmail) - The Local/Fallback Engine
    try {
        console.log(`[Email Engine] P2: Attempting SMTP (Port 465)...`);
        const info = await Promise.race([
            transporter.sendMail({
                from: fromEmail,
                to: Array.isArray(to) ? to.join(',') : to,
                subject,
                html,
                replyTo: reply_to
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP_PORT_465_TIMEOUT')), 10000))
        ]);
        console.log(`[Email Engine] SMTP P2 SUCCESS: ${info.messageId}`);
        return { ...info, provider: 'smtp-465' };
    } catch (smtp465Error) {
        console.warn(`[Email Engine] SMTP P2 FAILED: ${smtp465Error.message}. Trying P3 (587)...`);

        try {
            const info = await Promise.race([
                fallbackTransporter.sendMail({
                    from: fromEmail,
                    to: Array.isArray(to) ? to.join(',') : to,
                    subject,
                    html,
                    replyTo: reply_to
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP_PORT_587_TIMEOUT')), 10000))
            ]);
            console.log(`[Email Engine] SMTP P3 SUCCESS: ${info.messageId}`);
            return { ...info, provider: 'smtp-587' };
        } catch (smtp587Error) {
            console.error(`[Email Engine] ALL EMAIL STRATEGIES FAILED.`);
            throw new Error(`Unified Mailing Failure: [Resend Check Audit] + [SMTP465: ${smtp465Error.message}] + [SMTP587: ${smtp587Error.message}]`);
        }
    }
};

const sendSecurityAlert = async (subject, message, recipientEmail = null) => {
    const adminEmail = recipientEmail || process.env.ADMIN_EMAIL || 'ragulp.career@gmail.com';
    await sendEmail({
        to: adminEmail,
        subject: `ðŸš¨ SECURITY ALERT: ${subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ff0000; border-radius: 5px;">
                <h2 style="color: #ff0000;">âš ï¸ Security Incident Detected</h2>
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
        subject: `ðŸ“ NEW USER REGISTRATION: ${userInfo.name}`,
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
    const frontendUrl = resolveFrontendUrl();
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    return await sendEmail({
        to: userInfo.email,
        subject: `ðŸ” PASSWORD RESET: Action Required`,
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






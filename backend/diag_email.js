const nodemailer = require("nodemailer");
const { Resend } = require('resend');
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load env
const envPath = path.resolve(__dirname, "backend.env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

async function testEmail() {
    console.log("=== Email Diagnostic ===");
    console.log("Recipient: " + (process.env.ADMIN_EMAIL || "ragulp.career@gmail.com"));

    // 1. Test Resend
    if (process.env.RESEND_API_KEY) {
        console.log("\n--- Testing Resend ---");
        const resend = new Resend(process.env.RESEND_API_KEY);
        try {
            const { data, error } = await resend.emails.send({
                from: 'onboarding@resend.dev',
                to: [process.env.ADMIN_EMAIL || "ragulp.career@gmail.com"],
                subject: 'Diagnostic: Resend Test',
                html: '<p>Resend is working.</p>'
            });
            if (error) {
                console.error("Resend Error:", error);
            } else {
                console.log("Resend Success:", data);
            }
        } catch (err) {
            console.error("Resend Exception:", err.message);
        }
    } else {
        console.log("\nResend API Key missing.");
    }

    // 2. Test SMTP (Port 587)
    console.log("\n--- Testing SMTP (Port 587) ---");
    const transporter587 = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: (process.env.EMAIL_PASS || '').replace(/\s/g, ''),
        },
    });

    try {
        await transporter587.verify();
        console.log("SMTP 587 Verified.");
    } catch (err) {
        console.error("SMTP 587 Failed:", err.message);
    }

    // 3. Test SMTP (Port 465)
    console.log("\n--- Testing SMTP (Port 465) ---");
    const transporter465 = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: (process.env.EMAIL_PASS || '').replace(/\s/g, ''),
        },
    });

    try {
        await transporter465.verify();
        console.log("SMTP 465 Verified.");
    } catch (err) {
        console.error("SMTP 465 Failed:", err.message);
    }
}

testEmail();

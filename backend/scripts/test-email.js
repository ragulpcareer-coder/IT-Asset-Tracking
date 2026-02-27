require('dotenv').config({ path: '../.env' });
const nodemailer = require('nodemailer');

async function testGmail() {
    console.log('--- SMTP Diagnostic Tool ---');
    console.log('User:', process.env.EMAIL_USER || 'ragulp.career@gmail.com');
    // Mask password
    const pass = 'zsfc hren bghz hfwh';
    console.log('Pass:', pass.substring(0, 4) + '****' + pass.substring(pass.length - 4));

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER || 'ragulp.career@gmail.com',
            pass: pass.replace(/\s/g, ''),
        },
        debug: true,
        logger: true
    });

    try {
        console.log('\n[1/2] Verifying connection...');
        await transporter.verify();
        console.log('SUCCESS: SMTP handshake verified.');

        console.log('\n[2/2] Sending test packet...');
        const info = await transporter.sendMail({
            from: `"Diagnostic" <${process.env.EMAIL_USER || 'ragulp.career@gmail.com'}>`,
            to: process.env.EMAIL_USER || 'ragulp.career@gmail.com',
            subject: "SMTP Diagnostic Test",
            text: "Diagnostic successful. Your SMTP configuration is valid.",
        });
        console.log('SUCCESS: Email dispatched!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);

    } catch (err) {
        console.error('\n--- DIAGNOSTIC FAILURE ---');
        console.error('Error Code:', err.code);
        console.error('Error Message:', err.message);
        if (err.response) console.error('Server Response:', err.response);
        console.error('\nFull Stack Trace:', err.stack);

        console.log('\n--- TROUBLESHOOTING TIPS ---');
        console.log('1. If "Invalid login": Ensure you are using an APP PASSWORD, not your Gmail password.');
        console.log('2. If "ETIMEDOUT": Your network or ISP is blocking Port 465.');
        console.log('3. If "Self-signed certificate": Check your system time or network proxy.');
    }
}

testGmail();

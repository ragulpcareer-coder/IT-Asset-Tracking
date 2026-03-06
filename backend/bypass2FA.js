/**
 * bypass2FA.js — Emergency 2FA Reset/Fix Script (Two-Phase)
 *
 * PHASE 1: Use raw MongoDB to clear any corrupt/unencrypted 2FA fields.
 * PHASE 2: Use Mongoose model (with field encryption plugin) to store
 *          a fresh TOTP secret — properly encrypted this time.
 *
 * USAGE:
 *   cd backend
 *   node bypass2FA.js
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

const envPath = path.resolve(__dirname, "backend.env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

// We must load the User model AFTER dotenv so the encryption secret is available
const connectDB = require("./config/db");

const TARGET_EMAIL = "ragulp.career@gmail.com";

async function resetAndEnable2FA() {
    console.log("=== 2FA Emergency Reset Script (Two-Phase) ===\n");
    await connectDB();

    // ─── PHASE 1: Clear corrupt fields via raw MongoDB ───────────────────────
    // This bypasses mongoose-field-encryption, which would crash trying to
    // decrypt the wrongly-stored plaintext/corrupt values.
    console.log("📋 Phase 1: Clearing corrupt 2FA fields via raw MongoDB...");
    const clearResult = await mongoose.connection.db.collection('users').updateOne(
        { email: TARGET_EMAIL },
        {
            $set: {
                isTwoFactorEnabled: false,
                twoFactorBackupCodes: [],
            },
            $unset: {
                twoFactorSecret: "",
                __enc_twoFactorSecret: "",
                __enc_twoFactorBackupCodes: "",
            }
        }
    );

    if (clearResult.matchedCount === 0) {
        console.error(`❌ User not found: ${TARGET_EMAIL}`);
        process.exit(1);
    }
    console.log(`✅ Phase 1 complete — corrupt fields cleared for ${TARGET_EMAIL}\n`);

    // ─── PHASE 2: Re-provision with Mongoose (field encryption active) ────────
    console.log("🔐 Phase 2: Re-provisioning 2FA via Mongoose (encrypted storage)...");

    // NOW we can safely load the User model — encryption plugin won't crash
    // because the corrupt field has been cleared
    const User = require("./models/User");

    const user = await User.findOne({ email: TARGET_EMAIL });
    if (!user) {
        console.error(`❌ User still not found after clear — check DB connection.`);
        process.exit(1);
    }

    console.log(`✅ User loaded: ${user.name} (${user.email})`);

    // Generate a fresh TOTP secret
    const secret = speakeasy.generateSecret({
        name: `AssetTracker (${user.email})`,
        length: 32,
    });

    // Assign via Mongoose — triggers field encryption plugin on save
    user.twoFactorSecret = secret.base32;
    user.isTwoFactorEnabled = true;
    user.twoFactorBackupCodes = [];

    await user.save();

    console.log("\n✅ Phase 2 complete — 2FA re-provisioned with encrypted secret.\n");
    console.log("─────────────────────────────────────────────────────────");
    console.log(`📋 Base32 Secret (for manual entry in authenticator):\n   ${secret.base32}`);
    console.log(`\n🔗 OTPAuth URL:\n   ${secret.otpauth_url}`);

    // Generate QR to terminal
    try {
        const qrString = await qrcode.toString(secret.otpauth_url, { type: "terminal", small: true });
        console.log("\n📱 Scan this QR code with Google Authenticator / Authy:");
        console.log(qrString);
    } catch (_) {
        console.log("  (QR rendering unavailable — use the Base32 secret above for manual entry)");
    }

    console.log("─────────────────────────────────────────────────────────");
    console.log("✅ Done! Login now with your email/password.");
    console.log("   You will be prompted for a 6-digit TOTP code.");
    console.log("   Enter the code shown in Google Authenticator / Authy.\n");
    process.exit(0);
}

resetAndEnable2FA().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});

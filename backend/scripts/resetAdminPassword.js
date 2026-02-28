/**
 * ONE-TIME Admin Password Reset Script
 * Directly writes a new bcrypt-hashed password to MongoDB Atlas.
 * Bypasses ALL Mongoose middleware (no pre-save hook, no field-encryption).
 * Run once locally, then delete or keep for emergencies.
 *
 * Usage:
 *   node scripts/resetAdminPassword.js
 */

const path = require('path');
const fs = require('fs');

// Load env — force .env (has Atlas URI), NOT backend.env (has local MongoDB URI)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
console.log('[Reset] Loaded env from .env (Atlas URI)');
console.log('[Reset] MONGO_URI target:', (process.env.MONGO_URI || '').substring(0, 40) + '...');


const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── CONFIGURE HERE ──────────────────────────────────────────────────────────
const TARGET_EMAIL = 'ragulp.career@gmail.com';   // email to reset
const NEW_PASSWORD = 'AdminReset2026!!';           // new temp password (min 12 chars)
//  ─────────────────────────────────────────────────────────────────────────────

async function resetPassword() {
    console.log('\n[Reset] Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        family: 4
    });
    console.log('[Reset] Connected:', mongoose.connection.host);

    // Hash the new password directly with bcrypt — NO Mongoose involved
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(NEW_PASSWORD, salt);

    // Verify the hash is valid before writing
    const valid = await bcrypt.compare(NEW_PASSWORD, hashed);
    if (!valid) {
        console.error('[Reset] ABORT: Hash verification failed. Do not write to DB.');
        process.exit(1);
    }
    console.log('[Reset] Hash verified OK. Starts with:', hashed.substring(0, 7));

    // Use native MongoDB driver directly — completely bypasses Mongoose middleware
    const db = mongoose.connection.db;
    const collection = db.collection('users');

    const before = await collection.findOne(
        { email: TARGET_EMAIL },
        { projection: { email: 1, password: 1, role: 1, isApproved: 1 } }
    );

    if (!before) {
        console.error(`[Reset] ERROR: No user found with email: ${TARGET_EMAIL}`);
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`[Reset] Found user: ${before.email} | role: ${before.role} | isApproved: ${before.isApproved}`);
    console.log(`[Reset] Current password in DB: ${before.password ? `"${String(before.password).substring(0, 7)}..."` : 'NULL / UNDEFINED ← confirmed corrupted'}`);

    // Write the fresh hash directly via native MongoDB updateOne (no Mongoose hooks fire)
    const result = await collection.updateOne(
        { email: TARGET_EMAIL },
        {
            $set: {
                password: hashed,
                failedLoginAttempts: 0,
                isApproved: true,     // ensure admin account is approved
            },
            $unset: { lockUntil: '' }        // clear any account lockout
        }
    );

    if (result.modifiedCount === 1) {
        console.log('\n✅ Password reset successful!');
        console.log('─────────────────────────────────');
        console.log(`  Email   : ${TARGET_EMAIL}`);
        console.log(`  Password: ${NEW_PASSWORD}`);
        console.log('─────────────────────────────────');
        console.log('→ Login now with these credentials.');
        console.log('→ Change your password from the Settings page after login.\n');
    } else {
        console.error('[Reset] ERROR: updateOne matched 0 documents. Check the email spelling.');
    }

    await mongoose.disconnect();
    console.log('[Reset] Disconnected.');
}

resetPassword().catch(err => {
    console.error('[Reset] FATAL:', err.message);
    process.exit(1);
});

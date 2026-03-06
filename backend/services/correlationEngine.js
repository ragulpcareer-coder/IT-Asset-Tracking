"use strict";

/**
 * Security Event Correlation Engine
 * Detects patterns across recent auth events and triggers alerts.
 *
 * Rules:
 *  1. BRUTE_FORCE_DETECTED     — 5+ failed logins from same IP within 2 minutes
 *  2. PRIVILEGE_ESCALATION_ALERT — user promoted to admin then logs in from new device within 10 min
 *  3. OFF_HOURS_LOGIN           — successful login between 11pm–5am
 */

// In-memory event ring buffer (per IP, last 10 minutes)
const failedLoginsByIp = new Map(); // ip -> [timestamp, ...]

const BRUTE_FORCE_WINDOW_MS = 2 * 60 * 1000;    // 2 minutes
const BRUTE_FORCE_THRESHOLD = 5;
const OFF_HOURS_START = 23; // 11pm
const OFF_HOURS_END = 5;    // 5am

/**
 * Emit a security alert via Socket.IO and return the correlation result.
 * @param {object} io   - Socket.IO server instance
 * @param {string} type - Alert type constant
 * @param {object} data - Alert payload
 */
function emitAlert(io, type, data) {
    if (!io) return;
    const payload = { type, ...data, timestamp: new Date().toISOString() };
    io.emit("security_alert", payload);
    console.log(`[CorrelationEngine] Alert emitted: ${type}`, data?.ip || "");
}

/**
 * Rule 1 — Brute Force Detection
 * Call on every failed login.
 * @param {object} io
 * @param {string} ip
 * @param {string} email
 */
function checkBruteForce(io, ip, email) {
    if (!ip) return;
    const now = Date.now();
    const window = BRUTE_FORCE_WINDOW_MS;

    // Get existing attempts for this IP, prune old ones
    let attempts = (failedLoginsByIp.get(ip) || []).filter(t => now - t < window);
    attempts.push(now);
    failedLoginsByIp.set(ip, attempts);

    if (attempts.length >= BRUTE_FORCE_THRESHOLD) {
        emitAlert(io, "BRUTE_FORCE_DETECTED", {
            message: `${attempts.length} failed login attempts from the same IP in 2 minutes.`,
            ip,
            email,
            count: attempts.length,
        });
        // Reset the counter after alert to avoid spam
        failedLoginsByIp.set(ip, []);
    }
}

/**
 * Rule 2 — Off-Hours Login Detection
 * Call on every successful login.
 * @param {object} io
 * @param {string} ip
 * @param {string} email
 * @param {string} role
 */
function checkOffHoursLogin(io, ip, email, role) {
    const hour = new Date().getHours(); // local server time
    const isOffHours = hour >= OFF_HOURS_START || hour < OFF_HOURS_END;
    if (isOffHours) {
        emitAlert(io, "OFF_HOURS_LOGIN", {
            message: `Login detected outside business hours (${new Date().toLocaleTimeString()}).`,
            ip,
            email,
            role,
        });
    }
}

/**
 * Rule 3 — Admin Promotion + New Device Login
 * Call when a user is promoted to admin.
 * The frontend and audit log record the event; this stores it for 10-min correlation.
 * @param {object} io
 * @param {string} promotedUserId
 * @param {string} promotedEmail
 */
const recentPromotions = new Map(); // userId -> timestamp

function recordPromotion(io, promotedUserId, promotedEmail) {
    recentPromotions.set(promotedUserId, { ts: Date.now(), email: promotedEmail });
    // Auto-clean after 10 minutes
    setTimeout(() => recentPromotions.delete(promotedUserId), 10 * 60 * 1000);
}

function checkPrivilegeEscalation(io, userId, ip, isNewDevice) {
    if (!isNewDevice) return;
    const record = recentPromotions.get(String(userId));
    if (!record) return;
    const elapsed = Date.now() - record.ts;
    if (elapsed < 10 * 60 * 1000) {
        emitAlert(io, "PRIVILEGE_ESCALATION_ALERT", {
            message: `Newly promoted admin logged in from an unrecognized device within 10 minutes of promotion.`,
            ip,
            email: record.email,
        });
        recentPromotions.delete(String(userId));
    }
}

/**
 * Cleanup old IP records every 5 minutes to prevent memory leak
 */
setInterval(() => {
    const cutoff = Date.now() - BRUTE_FORCE_WINDOW_MS;
    for (const [ip, times] of failedLoginsByIp.entries()) {
        const fresh = times.filter(t => t > cutoff);
        if (fresh.length === 0) failedLoginsByIp.delete(ip);
        else failedLoginsByIp.set(ip, fresh);
    }
}, 5 * 60 * 1000);

module.exports = {
    checkBruteForce,
    checkOffHoursLogin,
    checkPrivilegeEscalation,
    recordPromotion,
    emitAlert,
};

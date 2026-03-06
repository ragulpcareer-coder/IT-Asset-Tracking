"use strict";

/**
 * Security Event Correlation Engine
 * Detects patterns across recent auth events and triggers alerts.
 *
 * Rules:
 *  1. BRUTE_FORCE_DETECTED         — 5+ failed logins from same IP within 2 minutes
 *  2. PRIVILEGE_ESCALATION_ALERT   — promoted admin logs in from new device within 10 min
 *  3. OFF_HOURS_LOGIN              — successful login between 11pm–5am
 *  4. HIGH_RISK_ALERT (COMPOUND)   — admin account + prior failed attempts + new device
 *     All 3 conditions must be true simultaneously → highest severity alert
 */

const SecurityAlert = require("../models/SecurityAlert");

// In-memory event ring buffer (per IP, last 10 minutes)
const failedLoginsByIp = new Map(); // ip -> [timestamp, ...]

const BRUTE_FORCE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const BRUTE_FORCE_THRESHOLD = 5;
const OFF_HOURS_START = 23; // 11pm
const OFF_HOURS_END = 5;    // 5am

/**
 * Emit a security alert via Socket.IO.
 */
function emitAlert(io, type, data) {
    if (!io) return;
    const payload = { type, ...data, timestamp: new Date().toISOString() };
    io.emit("security_alert", payload);

    // Centrally log to SecurityAlert model (§SOC Category 3)
    (async () => {
        try {
            await SecurityAlert.create({
                type: type,
                severity: data?.severity === 'critical' ? 'Critical' : (data?.severity === 'high' ? 'High' : (data?.severity === 'medium' ? 'Medium' : 'Low')),
                message: data?.message || `Security Alert: ${type}`,
                details: JSON.stringify(data),
                ip: data?.ip || "Unknown",
                performedBy: data?.email || data?.userId || "System",
                // Attempt to map to MITRE if possible
                mitreTactic: type.includes('BRUTE') ? 'Credential Access' : (type.includes('ESCALATION') ? 'Privilege Escalation' : 'Lateral Movement')
            });
        } catch (err) {
            console.error("[SOC] Alert persistence failure:", err.message);
        }
    })();

    console.log(`[CorrelationEngine] Alert emitted: ${type}`, data?.ip || "");
}

/**
 * Rule 1 — Brute Force Detection
 * Call on every failed login.
 */
function checkBruteForce(io, ip, email) {
    if (!ip) return;
    const now = Date.now();

    let attempts = (failedLoginsByIp.get(ip) || []).filter(t => now - t < BRUTE_FORCE_WINDOW_MS);
    attempts.push(now);
    failedLoginsByIp.set(ip, attempts);

    if (attempts.length >= BRUTE_FORCE_THRESHOLD) {
        emitAlert(io, "BRUTE_FORCE_DETECTED", {
            message: `${attempts.length} failed login attempts from the same IP in 2 minutes.`,
            ip, email,
            count: attempts.length,
            severity: "high",
        });
        failedLoginsByIp.set(ip, []); // reset after alert
    }
}

/**
 * Rule 2 — Off-Hours Login Detection
 * Call on every successful login.
 */
function checkOffHoursLogin(io, ip, email, role) {
    const hour = new Date().getHours();
    const isOffHours = hour >= OFF_HOURS_START || hour < OFF_HOURS_END;
    if (isOffHours) {
        emitAlert(io, "OFF_HOURS_LOGIN", {
            message: `Login detected outside business hours (${new Date().toLocaleTimeString()}).`,
            ip, email, role,
            severity: "medium",
        });
    }
}

/**
 * Rule 3 — Privilege Escalation (admin promoted → new device login within 10 min)
 */
const recentPromotions = new Map(); // userId -> { ts, email }

function recordPromotion(io, promotedUserId, promotedEmail) {
    recentPromotions.set(promotedUserId, { ts: Date.now(), email: promotedEmail });
    setTimeout(() => recentPromotions.delete(promotedUserId), 10 * 60 * 1000);
}

function checkPrivilegeEscalation(io, userId, ip, isNewDevice) {
    if (!isNewDevice) return;
    const record = recentPromotions.get(String(userId));
    if (!record) return;
    if (Date.now() - record.ts < 10 * 60 * 1000) {
        emitAlert(io, "PRIVILEGE_ESCALATION_ALERT", {
            message: `Newly promoted admin logged in from an unrecognized device within 10 minutes of promotion.`,
            ip,
            email: record.email,
            severity: "high",
        });
        recentPromotions.delete(String(userId));
    }
}

/**
 * Rule 4 — COMPOUND HIGH RISK ALERT ★
 *
 * Triggers when ALL THREE conditions are simultaneously true:
 *   ① Account is Admin or Super Admin (privileged)
 *   ② Account had prior failed login attempts before this successful login
 *   ③ This successful login is from a new, unrecognized device / IP
 *
 * Attack patterns this detects:
 *   → Account takeover: attacker brute-forced admin credentials and succeeded from a new machine
 *   → Credential stuffing against a privileged account (tried multiple times, finally passed)
 *   → Insider/stolen device: admin using an unauthorized device after prior failed attempts
 *
 * @param {object} io
 * @param {object} params
 * @param {string}  params.email           User email
 * @param {string}  params.role            User role (Admin / Super Admin)
 * @param {number}  params.failedAttempts  Failed attempt count BEFORE this login reset it to 0
 * @param {boolean} params.isNewDevice     true if this IP was not in user.devices[]
 * @param {string}  params.ip              Login IP address
 * @param {string}  params.userId          MongoDB user _id
 */
function checkHighRiskCompound(io, { email, role, failedAttempts, isNewDevice, ip, userId }) {
    const isPrivilegedAccount = ["Admin", "Super Admin"].includes(role);
    const hadPriorFailures = failedAttempts >= 2;
    const isUnknownDevice = isNewDevice;

    console.log(
        `[CorrelationEngine] HIGH_RISK check — role:${role} privileged:${isPrivilegedAccount}` +
        ` priorFails:${failedAttempts} newDevice:${isUnknownDevice}`
    );

    if (isPrivilegedAccount && hadPriorFailures && isUnknownDevice) {
        emitAlert(io, "HIGH_RISK_ALERT", {
            message:
                `🚨 HIGH RISK: Admin account "${email}" logged in successfully after ` +
                `${failedAttempts} failed attempt(s) from an unrecognized device. ` +
                `Possible account takeover or unauthorized access detected.`,
            email,
            role,
            ip,
            userId: String(userId),
            failedAttemptsBefore: failedAttempts,
            conditions: {
                privilegedAccount: true,
                priorFailedLogins: failedAttempts,
                newDevice: true,
            },
            severity: "critical",
            recommendedAction: "Verify this login with the account owner immediately. Consider forcing a password reset and revoking all active sessions.",
        });
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
    checkHighRiskCompound,
    recordPromotion,
    emitAlert,
};

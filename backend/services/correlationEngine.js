const SecurityAlert = require("../models/SecurityAlert");
const User = require("../models/User");

// In-memory event ring buffer (per IP, last 10 minutes)
const failedLoginsByIp = new Map(); // ip -> [timestamp, ...]

const BRUTE_FORCE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const BRUTE_FORCE_THRESHOLD = 5;
const OFF_HOURS_START = 23; // 11pm
const OFF_HOURS_END = 5;    // 5am

/**
 * Emit a security alert and persist to DB.
 */
async function triggerAlert(type, data) {
    const payload = {
        type: type,
        severity: (data.severity || "LOW").toUpperCase(),
        description: data.message || `Security Alert: ${type}`,
        sourceIp: data.ip || "Unknown",
        userId: data.userId || null,
        metadata: data.metadata || data,
        status: "OPEN"
    };

    try {
        // Prevent duplicate open alerts for the same thing in the last 15 mins
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const existing = await SecurityAlert.findOne({
            type: payload.type,
            userId: payload.userId,
            sourceIp: payload.sourceIp,
            status: "OPEN",
            createdAt: { $gte: fifteenMinsAgo }
        });

        if (existing) return;

        const alert = await SecurityAlert.create(payload);
        console.log(`[CorrelationEngine] 🚨 ALERT TRIGGERED: ${alert.type} (${alert.severity})`);

        // Emit via WebSockets
        if (global.io) {
            global.io.emit("security_alert", alert);
        }
    } catch (err) {
        console.error("[SOC] Alert persistence failure:", err.message);
    }
}

/**
 * Detect Brute Force
 */
function checkBruteForce(ip, email) {
    if (!ip) return;
    const now = Date.now();

    let attempts = (failedLoginsByIp.get(ip) || []).filter(t => now - t < BRUTE_FORCE_WINDOW_MS);
    attempts.push(now);
    failedLoginsByIp.set(ip, attempts);

    if (attempts.length >= BRUTE_FORCE_THRESHOLD) {
        triggerAlert("BRUTE_FORCE", {
            message: `Brute force attack detected: ${attempts.length} failures from IP ${ip} in 2 mins.`,
            ip,
            severity: "HIGH",
            metadata: { attempts: attempts.length, email }
        });
        failedLoginsByIp.set(ip, []); // reset
    }
}

/**
 * Detect Anomalies: Time, IP, Device
 */
async function checkAnomalies(userId, ip, metadata) {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        const hour = new Date().getHours();
        const isOffHours = hour >= OFF_HOURS_START || hour < OFF_HOURS_END;
        const isNewIp = user.behavioralMetadata.commonIps.length > 0 && !user.behavioralMetadata.commonIps.includes(ip);
        const isNewDevice = metadata && metadata.fingerprint && !user.behavioralMetadata.trustedDevices.includes(metadata.fingerprint);

        // 1. Off-Hours Login
        if (isOffHours) {
            triggerAlert("UNUSUAL_LOGIN_TIME", {
                message: `User ${user.email} logged in during off-hours (${hour}:00).`,
                ip, userId, severity: "MEDIUM",
                metadata: { hour }
            });
        }

        // 2. High Risk: Admin + New Device + Unusual Context
        if (["Super Admin", "Admin"].includes(user.role) && isNewDevice && isNewIp) {
            triggerAlert("NEW_DEVICE_ADMIN", {
                message: `CRITICAL: Admin account leveraged from unrecognized device and unusual IP.`,
                ip, userId, severity: "CRITICAL",
                metadata: { isNewDevice, isNewIp }
            });
        }

        // Update baseline
        await updateUserBaseline(user, ip, hour, metadata?.fingerprint);
    } catch (err) {
        console.error("[CorrelationEngine] Anomaly check error:", err);
    }
}

async function updateUserBaseline(user, ip, hour, fingerprint) {
    let changed = false;
    if (!user.behavioralMetadata) user.behavioralMetadata = {};

    if (!user.behavioralMetadata.commonIps.includes(ip)) {
        user.behavioralMetadata.commonIps.push(ip);
        if (user.behavioralMetadata.commonIps.length > 5) user.behavioralMetadata.commonIps.shift();
        changed = true;
    }
    if (!user.behavioralMetadata.typicalLoginHours.includes(hour)) {
        user.behavioralMetadata.typicalLoginHours.push(hour);
        changed = true;
    }
    if (fingerprint && !user.behavioralMetadata.trustedDevices.includes(fingerprint)) {
        user.behavioralMetadata.trustedDevices.push(fingerprint);
        changed = true;
    }

    if (changed) await user.save();
}

/**
 * Zero Trust Enforcement Alert
 */
function recordZeroTrustViolation(userId, reason, ip) {
    triggerAlert("ZERO_TRUST_VIOLATION", {
        message: `Zero Trust Policy Block: ${reason}`,
        userId, ip, severity: "HIGH",
        metadata: { reason }
    });
}

const recentPromotions = new Map();
function recordPromotion(promotedUserId, promotedEmail) {
    recentPromotions.set(String(promotedUserId), { ts: Date.now(), email: promotedEmail });
    setTimeout(() => recentPromotions.delete(String(promotedUserId)), 10 * 60 * 1000);
}

function checkPrivilegeEscalation(userId, ip, isNewDevice) {
    if (!isNewDevice) return;
    const record = recentPromotions.get(String(userId));
    if (record && (Date.now() - record.ts < 10 * 60 * 1000)) {
        triggerAlert("NEW_DEVICE_ADMIN", {
            message: `Newly promoted admin logged in from unknown device within 10m of promotion.`,
            ip, userId, severity: "HIGH",
            metadata: { email: record.email }
        });
        recentPromotions.delete(String(userId));
    }
}

module.exports = {
    checkBruteForce,
    checkAnomalies,
    recordZeroTrustViolation,
    recordPromotion,
    checkPrivilegeEscalation
};

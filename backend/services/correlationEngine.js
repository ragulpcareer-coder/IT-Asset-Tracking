"use strict";

/**
 * Security Event Correlation Engine (Elite Edition)
 *
 * Responsibilities:
 *  1. BRUTE_FORCE detection (5+ failures / 2min → alert, 10+ → IP ban)
 *  2. Anomaly detection: off-hours login, new device + new IP for admins
 *  3. Deduplication: no duplicate OPEN alert for same (type, userId, ip) within 15min
 *  4. Cooldowns: UNUSUAL_LOGIN_TIME fires at most once per user per 8h
 *  5. Single WebSocket broadcast path (global.io) — no double-emit
 *  6. Legacy shim so callers using emitAlert(io, type, data) still work
 */

const SecurityAlert = require("../models/SecurityAlert");
const User = require("../models/User");
const Asset = require("../models/Asset");
const { getGeoLocation } = require("../utils/geoIpService");

// ── In-memory state ───────────────────────────────────────────────────────────
const failedLoginsByIp = new Map(); // ip  → [timestamp, ...]
const offHoursCooldowns = new Map(); // userId → last alert timestamp
const BRUTE_FORCE_WINDOW_MS = 2 * 60 * 1000;  // 2 minutes
const BRUTE_FORCE_THRESHOLD = 5;
const OFF_HOURS_COOLDOWN_MS = 8 * 60 * 60 * 1000; // 8 hours per user
const OFF_HOURS_START = 23; // 11 pm
const OFF_HOURS_END = 5;  // 5 am

// ── Core alert pipeline ───────────────────────────────────────────────────────
/**
 * triggerAlert — single source of truth for creating + broadcasting alerts.
 * Deduplicates: no OPEN alert of the same (type, userId, sourceIp) within 15min.
 */
async function triggerAlert(type, data) {
    try {
        const geo = await getGeoLocation(data.ip || "Unknown");

        const payload = {
            type,
            severity: (data.severity || "LOW").toUpperCase(),
            description: data.message || `Security Alert: ${type}`,
            sourceIp: data.ip || "Unknown",
            userId: data.userId || null,
            metadata: {
                ...(data.metadata || {}),
                country: geo.country,
                city: geo.city,
                lat: geo.lat,
                lon: geo.lon
            },
            status: "OPEN"
        };

        // ── Deduplication: skip if identical OPEN alert exists in last 15min ──
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const existing = await SecurityAlert.findOne({
            type: payload.type,
            userId: payload.userId,
            sourceIp: payload.sourceIp,
            status: "OPEN",
            createdAt: { $gte: fifteenMinsAgo }
        });
        if (existing) {
            console.log(`[CorrelationEngine] Dedup suppressed: ${type} from ${payload.sourceIp}`);
            return;
        }

        // ── Correlate asset risk ──────────────────────────────────────────────
        const asset = await Asset.findOne({ ipAddress: payload.sourceIp });
        if (asset) {
            payload.assetId = asset._id;
            payload.riskScoreImpact = payload.severity === "CRITICAL" ? 25
                : payload.severity === "HIGH" ? 15 : 5;
            asset.activeAlertsScore = (asset.activeAlertsScore || 0) + payload.riskScoreImpact;
            await asset.save();
        }

        // ── Persist ───────────────────────────────────────────────────────────
        const alert = await SecurityAlert.create(payload);

        // ── Correlate to incident ─────────────────────────────────────────────
        await correlateToIncident(alert);

        // ── Single WebSocket broadcast ────────────────────────────────────────
        if (global.io) {
            global.io.emit("security_alert", alert);
        }

        console.log(`[CorrelationEngine] 🚨 ${alert.type} (${alert.severity}) — ID ${alert._id}`);

        // ── SOAR automated response ───────────────────────────────────────────
        setImmediate(async () => {
            try {
                const soarService = require("./soarService");
                const recentAlertCount = await SecurityAlert.countDocuments({
                    sourceIp: payload.sourceIp,
                    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
                });
                soarService.processAlert(alert, { recentAlertCount });
            } catch (soarErr) {
                console.error("[CorrelationEngine] SOAR dispatch error:", soarErr.message);
            }
        });

    } catch (err) {
        console.error("[CorrelationEngine] Alert pipeline failure:", err.message);
    }
}

// ── Incident grouping ─────────────────────────────────────────────────────────
async function correlateToIncident(alert) {
    try {
        const Incident = require("../models/Incident");
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        let incident = await Incident.findOne({
            sourceIp: alert.sourceIp,
            status: { $in: ["OPEN", "INVESTIGATING"] },
            createdAt: { $gte: fiveMinsAgo }
        });

        if (!incident) {
            incident = new Incident({
                title: `Threat from ${alert.sourceIp || "Unknown"}`,
                severity: alert.severity,
                sourceIp: alert.sourceIp,
                userId: alert.userId,
                assetId: alert.assetId,
                alerts: [alert._id],
                timeline: [{ event: "Incident Detected", details: `${alert.type}: ${alert.description}` }]
            });
        } else {
            incident.alerts.push(alert._id);
            const order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
            if (order.indexOf(alert.severity) > order.indexOf(incident.severity)) {
                incident.severity = alert.severity;
            }
            incident.timeline.push({
                event: "Additional Alert Correlated",
                details: `Alert: ${alert.type} added.`
            });
        }

        await incident.save();
        alert.incidentId = incident._id;
        await alert.save();
    } catch (err) {
        console.error("[CorrelationEngine] Incident correlation error:", err.message);
    }
}

// ── Rule 1: Brute Force ───────────────────────────────────────────────────────
function checkBruteForce(ip, email) {
    if (!ip) return;
    const now = Date.now();
    let attempts = (failedLoginsByIp.get(ip) || []).filter(t => now - t < BRUTE_FORCE_WINDOW_MS);
    attempts.push(now);
    failedLoginsByIp.set(ip, attempts);

    if (attempts.length >= 10) {
        triggerAlert("SUSPICIOUS_IP", {
            message: `IP ${ip} entering blacklist phase after ${attempts.length} failures.`,
            ip, severity: "CRITICAL",
            metadata: { attempts: attempts.length, email }
        });
        // Auto-ban
        try {
            const BlockedIp = require("../models/BlockedIp");
            BlockedIp.create({ ipAddress: ip, reason: `Brute Force Assault (${attempts.length} failures)` })
                .catch(err => console.error("[IP Ban Error]", err.message));
        } catch (_) { }
        failedLoginsByIp.set(ip, []); // reset after escalation
    } else if (attempts.length >= BRUTE_FORCE_THRESHOLD) {
        triggerAlert("BRUTE_FORCE", {
            message: `Brute force: ${attempts.length} failures from ${ip} in 2 min.`,
            ip, severity: "HIGH",
            metadata: { attempts: attempts.length, email }
        });
    }
}

// ── Rule 2: Behavioral Anomalies ──────────────────────────────────────────────
async function checkAnomalies(userId, ip, metadata) {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        const hour = new Date().getHours();
        const isOffHours = hour >= OFF_HOURS_START || hour < OFF_HOURS_END;
        const commonIps = user.behavioralMetadata?.commonIps || [];
        const trustedDevs = user.behavioralMetadata?.trustedDevices || [];
        const isNewIp = commonIps.length > 0 && !commonIps.includes(ip);
        const isNewDevice = metadata?.fingerprint && !trustedDevs.includes(metadata.fingerprint);

        // Off-hours alert — COOLDOWN: once per 8 hours per user
        if (isOffHours) {
            const lastFired = offHoursCooldowns.get(String(userId)) || 0;
            if (Date.now() - lastFired > OFF_HOURS_COOLDOWN_MS) {
                offHoursCooldowns.set(String(userId), Date.now());
                triggerAlert("UNUSUAL_LOGIN_TIME", {
                    message: `${user.email} logged in during off-hours (${hour}:00).`,
                    ip, userId, severity: "MEDIUM",
                    metadata: { hour }
                });
            }
        }

        // HIGH-RISK: Admin + new device + new IP simultaneously
        if (["Super Admin", "Admin"].includes(user.role) && isNewDevice && isNewIp) {
            triggerAlert("NEW_DEVICE_ADMIN", {
                message: `CRITICAL: Admin ${user.email} logged in from unrecognized device + IP.`,
                ip, userId, severity: "CRITICAL",
                metadata: { isNewDevice, isNewIp }
            });
        }

        // Update behavioural baseline
        await updateUserBaseline(user, ip, hour, metadata?.fingerprint);
    } catch (err) {
        console.error("[CorrelationEngine] Anomaly check error:", err.message);
    }
}

async function updateUserBaseline(user, ip, hour, fingerprint) {
    if (!user.behavioralMetadata) user.behavioralMetadata = {};
    let changed = false;

    const commonIps = user.behavioralMetadata.commonIps || [];
    if (!commonIps.includes(ip)) {
        commonIps.push(ip);
        if (commonIps.length > 5) commonIps.shift();
        user.behavioralMetadata.commonIps = commonIps;
        changed = true;
    }

    const hours = user.behavioralMetadata.typicalLoginHours || [];
    if (!hours.includes(hour)) {
        hours.push(hour);
        user.behavioralMetadata.typicalLoginHours = hours;
        changed = true;
    }

    if (fingerprint) {
        const devs = user.behavioralMetadata.trustedDevices || [];
        if (!devs.includes(fingerprint)) {
            devs.push(fingerprint);
            user.behavioralMetadata.trustedDevices = devs;
            changed = true;
        }
    }

    if (changed) {
        user.markModified("behavioralMetadata");
        await user.save();
    }
}

// ── Rule 3: Zero Trust Violation ──────────────────────────────────────────────
function recordZeroTrustViolation(userId, reason, ip) {
    triggerAlert("ZERO_TRUST_VIOLATION", {
        message: `Zero Trust Policy Blocked: ${reason}`,
        userId, ip, severity: "HIGH",
        metadata: { reason }
    });
}

// ── Rule 4: Privilege Escalation ──────────────────────────────────────────────
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
            message: `Newly promoted admin ${record.email} logged in from unknown device within 10m of promotion.`,
            ip, userId, severity: "HIGH",
            metadata: { email: record.email }
        });
        recentPromotions.delete(String(userId));
    }
}

// ── Legacy shim: some older callers use emitAlert(io, type, data) ─────────────
// We now ignore the `io` arg and route through triggerAlert for consistency.
function emitAlert(_io, type, data) {
    triggerAlert(type, data);
}

// ── In-memory cleanup (prevent memory leak) ───────────────────────────────────
setInterval(() => {
    const cutoff = Date.now() - BRUTE_FORCE_WINDOW_MS;
    for (const [ip, times] of failedLoginsByIp.entries()) {
        const fresh = times.filter(t => t > cutoff);
        if (fresh.length === 0) failedLoginsByIp.delete(ip);
        else failedLoginsByIp.set(ip, fresh);
    }
    // Clean up expired off-hours cooldowns
    for (const [uid, ts] of offHoursCooldowns.entries()) {
        if (Date.now() - ts > OFF_HOURS_COOLDOWN_MS) offHoursCooldowns.delete(uid);
    }
}, 5 * 60 * 1000);

module.exports = {
    triggerAlert,
    checkBruteForce,
    checkAnomalies,
    recordZeroTrustViolation,
    recordPromotion,
    checkPrivilegeEscalation,
    emitAlert, // legacy shim
};

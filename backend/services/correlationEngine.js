const SecurityAlert = require("../models/SecurityAlert");
const User = require("../models/User");
const Asset = require("../models/Asset");
const Incident = require("../models/Incident");
const threatIntel = require("./threatIntelService");

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
        // Elite 1: Threat Intelligence Reputation Check
        const intel = await threatIntel.checkIpReputation(payload.sourceIp);
        if (intel.isMalicious) {
            payload.severity = "CRITICAL";
            payload.description += ` [INTEL: Known ${intel.category} via ${intel.provider}]`;
        }

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

        // Elite 2: Asset Correlation & Risk Impact
        const asset = await Asset.findOne({ ipAddress: payload.sourceIp });
        if (asset) {
            payload.assetId = asset._id;
            payload.riskScoreImpact = (payload.severity === 'CRITICAL' ? 25 : (payload.severity === 'HIGH' ? 15 : 5));

            // Increment Asset's active alert score
            asset.activeAlertsScore = (asset.activeAlertsScore || 0) + payload.riskScoreImpact;
            await asset.save();
        }

        const alert = await SecurityAlert.create(payload);

        // Elite 3: Incident Grouping & Timeline
        await correlateToIncident(alert);

        console.log(`[CorrelationEngine] 🚨 ALERT TRIGGERED: ${alert.type} (${alert.severity})`);

        // Trigger Automated Response (SOAR)
        const soarService = require("./soarService");

        // Elite 4: Provide "Context" (Threshold check) to SOAR
        const recentAlertCount = await SecurityAlert.countDocuments({
            sourceIp: payload.sourceIp,
            createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
        });

        soarService.processAlert(alert, { recentAlertCount });

        // Emit via WebSockets
        if (global.io) {
            global.io.emit("security_alert", alert);
        }
    } catch (err) {
        console.error("[SOC] Alert persistence failure:", err.message);
    }
}

/**
 * Correlate alert to an existing incident or create a new one.
 */
async function correlateToIncident(alert) {
    try {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        let incident = await Incident.findOne({
            sourceIp: alert.sourceIp,
            status: { $in: ["OPEN", "INVESTIGATING"] },
            createdAt: { $gte: fiveMinsAgo }
        });

        if (!incident) {
            incident = new Incident({
                title: `Threat from ${alert.sourceIp || 'Unknown'}`,
                severity: alert.severity,
                sourceIp: alert.sourceIp,
                userId: alert.userId,
                assetId: alert.assetId,
                alerts: [alert._id],
                timeline: [{
                    event: "Incident Detected",
                    details: `Initial alert: ${alert.type} - ${alert.description}`
                }]
            });
        } else {
            incident.alerts.push(alert._id);
            // Upgrade severity if needed
            const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
            if (severities.indexOf(alert.severity) > severities.indexOf(incident.severity)) {
                incident.severity = alert.severity;
            }
            incident.timeline.push({
                event: "Additional Alert Correlated",
                details: `Alert: ${alert.type} added to incident.`
            });
        }

        await incident.save();
        alert.incidentId = incident._id;
        await alert.save();
    } catch (err) {
        console.error("[CorrelationEngine] Incident correlation error:", err);
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
    triggerAlert,
    checkBruteForce,
    checkAnomalies,
    recordZeroTrustViolation,
    recordPromotion,
    checkPrivilegeEscalation
};

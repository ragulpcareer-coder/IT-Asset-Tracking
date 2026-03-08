"use strict";

const SecurityAlert = require("../models/SecurityAlert");
const User = require("../models/User");
const Asset = require("../models/Asset");
const { getGeoLocation } = require("../utils/geoIpService");
const { isPrivateIp } = require("../utils/clientIp");

const failedLoginsByIp = new Map();
const offHoursCooldowns = new Map();
const deviceIpCooldowns = new Map();
const recentPromotions = new Map();

const BRUTE_FORCE_WINDOW_MS = 2 * 60 * 1000;
const BRUTE_FORCE_THRESHOLD = 5;
const BRUTE_FORCE_BLOCK_THRESHOLD = 10;
const OFF_HOURS_COOLDOWN_MS = 8 * 60 * 60 * 1000;
const DEVICE_IP_ALERT_COOLDOWN_MS = 30 * 60 * 1000;

const normalizeFingerprint = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const isPublicIp = (ip) => !!ip && ip !== "unknown" && !isPrivateIp(ip);

async function triggerAlert(type, data = {}) {
  try {
    const sourceIp = data.ip || "unknown";
    const geo = await getGeoLocation(sourceIp);

    const payload = {
      type,
      severity: String(data.severity || "LOW").toUpperCase(),
      description: data.message || `Security Alert: ${type}`,
      sourceIp,
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

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const existing = await SecurityAlert.findOne({
      type: payload.type,
      userId: payload.userId,
      sourceIp: payload.sourceIp,
      status: "OPEN",
      createdAt: { $gte: fifteenMinsAgo }
    }).lean();

    if (existing) return;

    const asset = await Asset.findOne({ ipAddress: payload.sourceIp });
    if (asset) {
      payload.assetId = asset._id;
      payload.riskScoreImpact = payload.severity === "CRITICAL" ? 25 : payload.severity === "HIGH" ? 15 : 5;
      asset.activeAlertsScore = (asset.activeAlertsScore || 0) + payload.riskScoreImpact;
      await asset.save();
    }

    const alert = await SecurityAlert.create(payload);
    await correlateToIncident(alert);

    if (global.io) {
      global.io.emit("security_alert", alert);
    }

    setImmediate(async () => {
      try {
        const soarService = require("./soarService");
        const recentAlertCount = await SecurityAlert.countDocuments({
          sourceIp: payload.sourceIp,
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
        });
        await soarService.processAlert(alert, { recentAlertCount });
      } catch (soarErr) {
        console.error("[CorrelationEngine] Automation dispatch error:", soarErr.message);
      }
    });
  } catch (err) {
    console.error("[CorrelationEngine] Alert pipeline failure:", err.message);
  }
}

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
      incident.timeline.push({ event: "Additional Alert Correlated", details: `Alert: ${alert.type} added.` });
    }

    await incident.save();
    alert.incidentId = incident._id;
    await alert.save();
  } catch (err) {
    console.error("[CorrelationEngine] Incident correlation error:", err.message);
  }
}

function checkBruteForce(ip, email) {
  if (!ip || ip === "unknown") return;

  const now = Date.now();
  const attempts = (failedLoginsByIp.get(ip) || []).filter((t) => now - t < BRUTE_FORCE_WINDOW_MS);
  attempts.push(now);
  failedLoginsByIp.set(ip, attempts);

  if (attempts.length >= BRUTE_FORCE_BLOCK_THRESHOLD) {
    triggerAlert("SUSPICIOUS_IP", {
      message: `IP ${ip} entered block phase after ${attempts.length} failed attempts.`,
      ip,
      severity: "CRITICAL",
      metadata: { attempts: attempts.length, email }
    });

    try {
      const BlockedIp = require("../models/BlockedIp");
      BlockedIp.create({ ipAddress: ip, reason: `Brute-force threshold exceeded (${attempts.length})` }).catch(() => {});
    } catch {}

    failedLoginsByIp.set(ip, []);
    return;
  }

  if (attempts.length >= BRUTE_FORCE_THRESHOLD) {
    triggerAlert("BRUTE_FORCE", {
      message: `Brute-force pattern detected: ${attempts.length} failed attempts from ${ip} in 2 minutes.`,
      ip,
      severity: "HIGH",
      metadata: { attempts: attempts.length, email }
    });
  }
}

async function checkAnomalies(userId, ip, metadata = {}) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const fingerprint = normalizeFingerprint(metadata.fingerprint);
    const commonIps = user.behavioralMetadata?.commonIps || [];
    const trustedDevices = user.behavioralMetadata?.trustedDevices || [];
    const loginHours = user.behavioralMetadata?.typicalLoginHours || [];

    const hour = new Date().getHours();
    const hasHourBaseline = loginHours.length >= 6;
    const unusualHour = hasHourBaseline && !loginHours.includes(hour);

    if (unusualHour) {
      const lastFired = offHoursCooldowns.get(String(userId)) || 0;
      if (Date.now() - lastFired > OFF_HOURS_COOLDOWN_MS) {
        offHoursCooldowns.set(String(userId), Date.now());
        await triggerAlert("UNUSUAL_LOGIN_TIME", {
          message: `${user.email} logged in at an unusual time (${hour}:00).`,
          ip,
          userId,
          severity: "MEDIUM",
          metadata: { hour }
        });
      }
    }

    const publicIp = isPublicIp(ip);
    const hasIpBaseline = publicIp && commonIps.length >= 3;
    const isNewIp = hasIpBaseline && !commonIps.includes(ip);
    const isNewDevice = !!fingerprint && trustedDevices.length > 0 && !trustedDevices.includes(fingerprint);

    if (["Super Admin", "Admin"].includes(user.role) && isNewDevice && isNewIp) {
      const cooldownKey = `${userId}:${ip}:${fingerprint}`;
      const lastDeviceIpAlert = deviceIpCooldowns.get(cooldownKey) || 0;
      if (Date.now() - lastDeviceIpAlert > DEVICE_IP_ALERT_COOLDOWN_MS) {
        deviceIpCooldowns.set(cooldownKey, Date.now());
        await triggerAlert("NEW_DEVICE_ADMIN", {
          message: `Admin login from new device and new public IP detected for ${user.email}.`,
          ip,
          userId,
          severity: "HIGH",
          metadata: {
            fingerprint: fingerprint.slice(0, 32),
            baselineIps: commonIps.slice(-3)
          }
        });
      }
    }

    await updateUserBaseline(user, ip, hour, fingerprint);
  } catch (err) {
    console.error("[CorrelationEngine] Anomaly check error:", err.message);
  }
}

async function updateUserBaseline(user, ip, hour, fingerprint) {
  if (!user.behavioralMetadata) user.behavioralMetadata = {};

  let changed = false;

  const hours = user.behavioralMetadata.typicalLoginHours || [];
  if (!hours.includes(hour)) {
    hours.push(hour);
    if (hours.length > 24) hours.shift();
    user.behavioralMetadata.typicalLoginHours = hours;
    changed = true;
  }

  if (isPublicIp(ip)) {
    const commonIps = user.behavioralMetadata.commonIps || [];
    if (!commonIps.includes(ip)) {
      commonIps.push(ip);
      if (commonIps.length > 10) commonIps.shift();
      user.behavioralMetadata.commonIps = commonIps;
      changed = true;
    }
  }

  if (fingerprint) {
    const trustedDevices = user.behavioralMetadata.trustedDevices || [];
    if (!trustedDevices.includes(fingerprint)) {
      trustedDevices.push(fingerprint);
      if (trustedDevices.length > 20) trustedDevices.shift();
      user.behavioralMetadata.trustedDevices = trustedDevices;
      changed = true;
    }
  }

  if (changed) {
    user.markModified("behavioralMetadata");
    await user.save();
  }
}

function recordZeroTrustViolation(userId, reason, ip) {
  triggerAlert("ZERO_TRUST_VIOLATION", {
    message: `Zero Trust policy blocked request: ${reason}`,
    userId,
    ip,
    severity: "HIGH",
    metadata: { reason }
  });
}

function recordPromotion(promotedUserId, promotedEmail) {
  recentPromotions.set(String(promotedUserId), { ts: Date.now(), email: promotedEmail });
  setTimeout(() => recentPromotions.delete(String(promotedUserId)), 10 * 60 * 1000);
}

function checkPrivilegeEscalation(userId, ip, isNewDevice) {
  if (!isNewDevice) return;
  const record = recentPromotions.get(String(userId));
  if (record && Date.now() - record.ts < 10 * 60 * 1000) {
    triggerAlert("NEW_DEVICE_ADMIN", {
      message: `Newly promoted admin ${record.email} logged in from an unknown device within 10 minutes.`,
      ip,
      userId,
      severity: "HIGH",
      metadata: { email: record.email }
    });
    recentPromotions.delete(String(userId));
  }
}

function emitAlert(_io, type, data) {
  triggerAlert(type, data);
}

setInterval(() => {
  const cutoff = Date.now() - BRUTE_FORCE_WINDOW_MS;
  for (const [ip, timestamps] of failedLoginsByIp.entries()) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) failedLoginsByIp.delete(ip);
    else failedLoginsByIp.set(ip, fresh);
  }

  for (const [uid, ts] of offHoursCooldowns.entries()) {
    if (Date.now() - ts > OFF_HOURS_COOLDOWN_MS) offHoursCooldowns.delete(uid);
  }

  for (const [key, ts] of deviceIpCooldowns.entries()) {
    if (Date.now() - ts > DEVICE_IP_ALERT_COOLDOWN_MS) deviceIpCooldowns.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = {
  triggerAlert,
  checkBruteForce,
  checkAnomalies,
  recordZeroTrustViolation,
  recordPromotion,
  checkPrivilegeEscalation,
  emitAlert
};


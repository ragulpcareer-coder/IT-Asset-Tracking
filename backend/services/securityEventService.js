"use strict";

const SecurityEvent = require("../models/SecurityEvent");

const toSeverity = (value) => {
  const normalized = String(value || "LOW").toUpperCase();
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(normalized) ? normalized : "LOW";
};

const toIpType = (value) => {
  const normalized = String(value || "UNKNOWN").toUpperCase();
  return ["PUBLIC", "PRIVATE", "UNKNOWN"].includes(normalized) ? normalized : "UNKNOWN";
};

async function ingestFromAlert(alertDoc) {
  if (!alertDoc) return null;

  const metadata = alertDoc.metadata || {};
  const payload = {
    externalAlertId: alertDoc._id || null,
    eventType: alertDoc.type || "UNKNOWN_EVENT",
    severity: toSeverity(alertDoc.severity),
    status: alertDoc.status || "OPEN",
    description: alertDoc.description || "",
    sourceIp: alertDoc.sourceIp || "unknown",
    ipType: toIpType(metadata.ipType),
    geoConfidence: metadata.geoConfidence || "low",
    country: metadata.country || "Unknown",
    city: metadata.city || "Unknown",
    lat: Number(metadata.lat || 0),
    lon: Number(metadata.lon || 0),
    asn: metadata.asn || "Unknown",
    isp: metadata.isp || "Unknown",
    org: metadata.org || "Unknown",
    abuseScore: Number.isFinite(Number(metadata.abuseScore)) ? Number(metadata.abuseScore) : 0,
    intelConfidence: metadata.intelConfidence || "low",
    sourceCountry: metadata.country || "Unknown",
    targetAssetId: alertDoc.assetId || metadata.assetId || null,
    targetIp: metadata.targetIp || "",
    userId: alertDoc.userId || null,
    metadata,
    aiAnalysis: alertDoc.aiAnalysis || undefined,
    occurredAt: alertDoc.createdAt || new Date()
  };

  if (!payload.externalAlertId) {
    return SecurityEvent.create(payload);
  }

  return SecurityEvent.findOneAndUpdate(
    { externalAlertId: payload.externalAlertId },
    { $set: payload },
    { upsert: true, new: true }
  );
}

async function listRecentEvents(limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
  return SecurityEvent.find({})
    .populate("userId", "name email role")
    .sort({ occurredAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function getMapEvents(hours = 24, limit = 250) {
  const windowStart = new Date(Date.now() - Math.max(Number(hours) || 24, 1) * 60 * 60 * 1000);
  const safeLimit = Math.min(Math.max(Number(limit) || 250, 1), 500);

  return SecurityEvent.find({
    occurredAt: { $gte: windowStart },
    lat: { $ne: 0 },
    lon: { $ne: 0 }
  })
    .sort({ occurredAt: -1 })
    .limit(safeLimit)
    .lean();
}

module.exports = {
  ingestFromAlert,
  listRecentEvents,
  getMapEvents
};


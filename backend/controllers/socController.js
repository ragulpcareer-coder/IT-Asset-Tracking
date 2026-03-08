const Incident = require("../models/Incident");
const SecurityAlert = require("../models/SecurityAlert");
const SecurityEvent = require("../models/SecurityEvent");
const User = require("../models/User");
const BlockedIp = require("../models/BlockedIp");
const attackSimulator = require("../services/attackSimulator");
const { getGeoLocation } = require("../utils/geoIpService");
const securityEventService = require("../services/securityEventService");

const simulateBruteForce = async (req, res) => {
    try {
        const { email, ip } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Target email required for simulation." });
        const result = await attackSimulator.simulateBruteForce(email, ip);
        return res.json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Simulation failed.", error: error.message });
    }
};

const simulateInsiderThreat = async (req, res) => {
    try {
        const { userId, ip } = req.body;
        const result = await attackSimulator.simulateInsiderThreat(userId || req.user._id, ip);
        return res.json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Simulation failed.", error: error.message });
    }
};

const simulateZeroTrustViolation = async (req, res) => {
    try {
        const { userId, ip } = req.body;
        const result = await attackSimulator.simulateZeroTrustViolation(userId || req.user._id, ip);
        return res.json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Simulation failed.", error: error.message });
    }
};

const simulateExploitPattern = async (req, res) => {
    try {
        const { userId, ip } = req.body;
        const result = await attackSimulator.simulateExploitPattern(userId || req.user._id, ip);
        return res.json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Simulation failed.", error: error.message });
    }
};

const getIncidents = async (req, res) => {
    try {
        const incidents = await Incident.find().sort({ createdAt: -1 }).populate("userId", "email role");
        return res.json({ success: true, incidents });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch incidents.", error: error.message });
    }
};

const getIncidentById = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id)
            .populate("userId", "email role")
            .populate("alerts")
            .populate("assetId");

        if (!incident) return res.status(404).json({ success: false, message: "Incident not found." });
        return res.json({ success: true, incident });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch incident.", error: error.message });
    }
};

const getSocStats = async (req, res) => {
    try {
        const [
            totalAlerts,
            activeIncidents,
            lockedAccounts,
            blockedIps,
            highRiskUsers,
            geoTelemetry
        ] = await Promise.all([
            SecurityEvent.countDocuments(),
            Incident.countDocuments({ status: { $in: ["OPEN", "INVESTIGATING"] } }),
            User.countDocuments({ lockUntil: { $gt: new Date() } }),
            BlockedIp.countDocuments({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }),
            User.find({ "behavioralMetadata.threatLevel": { $in: ["HIGH", "CRITICAL"] } })
                .select("email behavioralMetadata.riskScore behavioralMetadata.threatLevel")
                .sort({ "behavioralMetadata.riskScore": -1 })
                .limit(10)
                .lean(),
            SecurityEvent.aggregate([
                {
                    $match: {
                        country: { $exists: true, $nin: ["Unknown", "Internal/Local", "Localhost"] }
                    }
                },
                { $group: { _id: "$country", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 8 }
            ])
        ]);

        return res.json({
            success: true,
            totalAlerts,
            activeIncidents,
            lockedAccounts,
            blockedIps,
            highRiskUsers,
            geoTelemetry,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch SOC stats.", error: error.message });
    }
};

const getThreatMapPoints = async (req, res) => {
    try {
        const events = await securityEventService.getMapEvents(24, 300);
        const points = await Promise.all(events.map(async (e) => {
            const missingIntel = !e.asn || !e.isp;
            const liveIntel = missingIntel ? await getGeoLocation(e.sourceIp) : null;

            return {
                id: e._id,
                type: e.eventType,
                severity: e.severity,
                ip: e.sourceIp,
                lat: e.lat,
                lon: e.lon,
                country: e.country || liveIntel?.country || "Unknown",
                ipType: e.ipType || liveIntel?.ipType || "UNKNOWN",
                geoConfidence: e.geoConfidence || liveIntel?.geoConfidence || "low",
                asn: e.asn || liveIntel?.asn || "Unknown",
                isp: e.isp || liveIntel?.isp || "Unknown",
                org: e.org || liveIntel?.org || "Unknown",
                abuseScore: Number.isFinite(Number(e.abuseScore))
                    ? Number(e.abuseScore)
                    : (Number.isFinite(Number(liveIntel?.abuseScore)) ? Number(liveIntel.abuseScore) : 0),
                intelConfidence: e.intelConfidence || liveIntel?.intelConfidence || "low",
                time: e.occurredAt || e.createdAt
            };
        }));

        return res.json({ success: true, points });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch threat map points." });
    }
};

module.exports = {
    simulateBruteForce,
    simulateInsiderThreat,
    simulateZeroTrustViolation,
    simulateExploitPattern,
    getIncidents,
    getIncidentById,
    getSocStats,
    getThreatMapPoints
};

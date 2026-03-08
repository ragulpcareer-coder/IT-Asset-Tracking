const Incident = require("../models/Incident");
const SecurityAlert = require("../models/SecurityAlert");
const User = require("../models/User");
const BlockedIp = require("../models/BlockedIp");
const attackSimulator = require("../services/attackSimulator");

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
            SecurityAlert.countDocuments(),
            Incident.countDocuments({ status: { $in: ["OPEN", "INVESTIGATING"] } }),
            User.countDocuments({ lockUntil: { $gt: new Date() } }),
            BlockedIp.countDocuments({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }),
            User.find({ "behavioralMetadata.threatLevel": { $in: ["HIGH", "CRITICAL"] } })
                .select("email behavioralMetadata.riskScore behavioralMetadata.threatLevel")
                .sort({ "behavioralMetadata.riskScore": -1 })
                .limit(10)
                .lean(),
            SecurityAlert.aggregate([
                {
                    $match: {
                        "metadata.country": { $exists: true, $nin: ["Unknown", "Internal/Local", "Localhost"] }
                    }
                },
                { $group: { _id: "$metadata.country", count: { $sum: 1 } } },
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
        const alerts = await SecurityAlert.find({
            "metadata.lat": { $exists: true, $ne: 0 },
            "metadata.lon": { $exists: true, $ne: 0 },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
            .select("type severity sourceIp metadata.lat metadata.lon metadata.country createdAt")
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        const points = alerts.map((a) => ({
            id: a._id,
            type: a.type,
            severity: a.severity,
            ip: a.sourceIp,
            lat: a.metadata?.lat,
            lon: a.metadata?.lon,
            country: a.metadata?.country || "Unknown",
            ipType: a.metadata?.ipType || "UNKNOWN",
            geoConfidence: a.metadata?.geoConfidence || "low",
            time: a.createdAt
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

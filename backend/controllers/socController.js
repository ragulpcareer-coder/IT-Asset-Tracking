const Incident = require("../models/Incident");
const SecurityAlert = require("../models/SecurityAlert");
const User = require("../models/User");
const attackSimulator = require("../services/attackSimulator");

/**
 * SOC Controller
 * Handles attack simulations, incident management, and security metrics.
 */

// --- Attack Simulations ---

const simulateBruteForce = async (req, res) => {
    try {
        const { email, ip } = req.body;
        if (!email) return res.status(400).json({ message: "Target email required for simulation." });
        const result = await attackSimulator.simulateBruteForce(email, ip);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Simulation failed.", error: error.message });
    }
};

const simulateInsiderThreat = async (req, res) => {
    try {
        const { userId, ip } = req.body;
        const result = await attackSimulator.simulateInsiderThreat(userId || req.user._id, ip);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Simulation failed.", error: error.message });
    }
};

const simulateZeroTrustViolation = async (req, res) => {
    try {
        const { userId, ip } = req.body;
        const result = await attackSimulator.simulateZeroTrustViolation(userId || req.user._id, ip);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Simulation failed.", error: error.message });
    }
};

const simulateExploitPattern = async (req, res) => {
    try {
        const { userId, ip } = req.body;
        const result = await attackSimulator.simulateExploitPattern(userId || req.user._id, ip);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Simulation failed.", error: error.message });
    }
};

// --- Incident Management ---

const getIncidents = async (req, res) => {
    try {
        const incidents = await Incident.find().sort({ createdAt: -1 }).populate("userId", "email role");
        res.json(incidents);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch incidents.", error: error.message });
    }
};

const getIncidentById = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id)
            .populate("userId", "email role")
            .populate("alerts")
            .populate("assetId");
        if (!incident) return res.status(404).json({ message: "Incident not found." });
        res.json(incident);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch incident.", error: error.message });
    }
};

const getSocStats = async (req, res) => {
    try {
        const [totalAlerts, activeIncidents, lockedAccounts, blockedIpsCount, highRiskUsers, geoTelemetry] = await Promise.all([
            SecurityAlert.countDocuments(),
            Incident.countDocuments({ status: { $in: ["OPEN", "INVESTIGATING"] } }),
            User.countDocuments({ isActive: false, lockUntil: { $exists: true } }),
            SecurityAlert.distinct("sourceIp"),
            User.find({ "behavioralMetadata.threatLevel": { $in: ["HIGH", "CRITICAL"] } })
                .select("email behavioralMetadata.riskScore behavioralMetadata.threatLevel")
                .sort({ "behavioralMetadata.riskScore": -1 })
                .limit(10),
            SecurityAlert.aggregate([
                { $match: { "metadata.country": { $exists: true, $ne: "Unknown" } } },
                { $group: { _id: "$metadata.country", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 8 }
            ])
        ]);

        res.json({
            totalAlerts,
            activeIncidents,
            lockedAccounts,
            blockedIps: blockedIpsCount.length,
            highRiskUsers,
            geoTelemetry,
            lastUpdated: new Date()
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch SOC stats.", error: error.message });
    }
};

/**
 * @desc    Get GPS coordinates for the World Threat Map
 * @route   GET /api/security/threat-map
 * @access  Private/Admin
 */
const getThreatMapPoints = async (req, res) => {
    try {
        const alerts = await SecurityAlert.find({
            "metadata.lat": { $exists: true, $ne: 0 },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        })
            .select("type severity sourceIp metadata.lat metadata.lon createdAt")
            .limit(100);

        const points = alerts.map(a => ({
            id: a._id,
            type: a.type,
            severity: a.severity,
            ip: a.sourceIp,
            lat: a.metadata.lat,
            lon: a.metadata.lon,
            time: a.createdAt
        }));

        res.json(points);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch threat map points." });
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

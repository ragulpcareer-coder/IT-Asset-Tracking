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

// --- SOC Stats ---

const getSocStats = async (req, res) => {
    try {
        const [totalAlerts, activeIncidents, lockedAccounts, blockedIpsCount, highRiskUsers] = await Promise.all([
            SecurityAlert.countDocuments(),
            Incident.countDocuments({ status: { $in: ["OPEN", "INVESTIGATING"] } }),
            User.countDocuments({ isActive: false, lockUntil: { $exists: true } }),
            SecurityAlert.distinct("sourceIp"),
            User.find({ "behavioralMetadata.threatLevel": { $in: ["HIGH", "CRITICAL"] } })
                .select("email behavioralMetadata.riskScore behavioralMetadata.threatLevel")
                .sort({ "behavioralMetadata.riskScore": -1 })
                .limit(10)
        ]);

        res.json({
            totalAlerts,
            activeIncidents,
            lockedAccounts,
            blockedIps: blockedIpsCount.length,
            highRiskUsers,
            lastUpdated: new Date()
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch SOC stats.", error: error.message });
    }
};

module.exports = {
    simulateBruteForce,
    simulateInsiderThreat,
    simulateZeroTrustViolation,
    simulateExploitPattern,
    getIncidents,
    getIncidentById,
    getSocStats
};

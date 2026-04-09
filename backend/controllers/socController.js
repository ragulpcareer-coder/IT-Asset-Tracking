const Incident = require("../models/Incident");
const SecurityEvent = require("../models/SecurityEvent");
const User = require("../models/User");
const BlockedIp = require("../models/BlockedIp");
const attackSimulator = require("../services/attackSimulator");
const { getGeoLocation } = require("../utils/geoIpService");
const securityEventService = require("../services/securityEventService");
const { sendError, sendSuccess } = require("../utils/apiResponse");

const simulateBruteForce = async (req, res) => {
    try {
        const { email, ip } = req.body;
        const result = await attackSimulator.simulateBruteForce(email, ip);
        return sendSuccess(res, 200, "Brute-force simulation completed", result);
    } catch (error) {
        return sendError(res, 500, "Simulation failed.");
    }
};

const simulateInsiderThreat = async (req, res) => {
    try {
        const { userId, ip } = req.body;
        const result = await attackSimulator.simulateInsiderThreat(userId || req.user._id, ip);
        return sendSuccess(res, 200, "Insider threat simulation completed", result);
    } catch (error) {
        return sendError(res, 500, "Simulation failed.");
    }
};

const simulateZeroTrustViolation = async (req, res) => {
    try {
        const { userId, ip } = req.body;
        const result = await attackSimulator.simulateZeroTrustViolation(userId || req.user._id, ip);
        return sendSuccess(res, 200, "Zero-trust simulation completed", result);
    } catch (error) {
        return sendError(res, 500, "Simulation failed.");
    }
};

const simulateExploitPattern = async (req, res) => {
    try {
        const { userId, ip } = req.body;
        const result = await attackSimulator.simulateExploitPattern(userId || req.user._id, ip);
        return sendSuccess(res, 200, "Exploit simulation completed", result);
    } catch (error) {
        return sendError(res, 500, "Simulation failed.");
    }
};

const getIncidents = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

        const [incidents, total] = await Promise.all([
            Incident.find()
                .sort({ createdAt: -1 })
                .populate("userId", "email role")
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Incident.countDocuments(),
        ]);

        return sendSuccess(res, 200, "Incidents fetched successfully", {
            incidents,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch incidents.");
    }
};

const getIncidentById = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id)
            .populate("userId", "email role")
            .populate("alerts")
            .populate("assetId")
            .lean();

        if (!incident) return sendError(res, 404, "Incident not found.", { id: "invalid_incident" });
        return sendSuccess(res, 200, "Incident fetched successfully", { incident });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch incident.");
    }
};

const getSocStats = async (req, res) => {
    try {
        const [stats] = await SecurityEvent.aggregate([
            {
                $facet: {
                    totalAlerts: [{ $count: "count" }],
                    geoTelemetry: [
                        {
                            $match: {
                                country: { $exists: true, $nin: ["Unknown", "Internal/Local", "Localhost"] }
                            }
                        },
                        { $group: { _id: "$country", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 8 }
                    ]
                }
            }
        ]);

        const [activeIncidents, lockedAccounts, blockedIps, highRiskUsers] = await Promise.all([
            Incident.countDocuments({ status: { $in: ["OPEN", "INVESTIGATING"] } }),
            User.countDocuments({ lockUntil: { $gt: new Date() } }),
            BlockedIp.countDocuments({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }),
            User.find({ "behavioralMetadata.threatLevel": { $in: ["HIGH", "CRITICAL"] } })
                .select("email behavioralMetadata.riskScore behavioralMetadata.threatLevel")
                .sort({ "behavioralMetadata.riskScore": -1 })
                .limit(10)
                .lean(),
        ]);

        return sendSuccess(res, 200, "SOC stats fetched successfully", {
            totalAlerts: stats?.totalAlerts?.[0]?.count || 0,
            activeIncidents,
            lockedAccounts,
            blockedIps,
            highRiskUsers,
            geoTelemetry: stats?.geoTelemetry || [],
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch SOC stats.");
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

        return sendSuccess(res, 200, "Threat map points fetched successfully", { points });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch threat map points.");
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

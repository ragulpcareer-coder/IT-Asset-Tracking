const { GoogleGenerativeAI } = require("@google/generative-ai");
const SecurityAlert = require("../models/SecurityAlert");
const SecurityEvent = require("../models/SecurityEvent");
const securityEventService = require("../services/securityEventService");
const { sendError, sendSuccess } = require("../utils/apiResponse");

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const analyzeAlert = async (req, res) => {
    try {
        const { alertId } = req.params;
        let alert = await SecurityAlert.findById(alertId).populate("userId", "email role");
        let sourceModel = "SecurityAlert";

        if (!alert) {
            alert = await SecurityEvent.findById(alertId).populate("userId", "email role");
            sourceModel = "SecurityEvent";
        }

        if (!alert) {
            return sendError(res, 404, "Security alert not found.", { alertId: "invalid_alert" });
        }

        if (alert.aiAnalysis && alert.aiAnalysis.explanation && (Date.now() - new Date(alert.aiAnalysis.analyzedAt).getTime() < 24 * 60 * 60 * 1000)) {
            return sendSuccess(res, 200, "Cached AI analysis returned", { analysis: alert.aiAnalysis });
        }

        if (!genAI) {
            const mockAnalysis = {
                explanation: `Gemini API key not configured. Placeholder analysis for ${alert.type}. The pattern suggests unusual activity from IP ${alert.sourceIp}.`,
                recommendation: "Configure GEMINI_API_KEY in the environment. Recommended manual action: investigate the source IP and related user activity.",
                confidence: 0.5,
                analyzedAt: new Date()
            };
            alert.aiAnalysis = mockAnalysis;
            await alert.save();
            if (sourceModel === "SecurityAlert") {
                await securityEventService.ingestFromAlert(alert);
            }
            return sendSuccess(res, 200, "Fallback AI analysis generated", { analysis: mockAnalysis });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
      You are a Senior SOC (Security Operations Center) Analyst.
      Analyze the following security alert from an IT Asset Tracking system:

      Alert Type: ${alert.type}
      Severity: ${alert.severity}
      Description: ${alert.description}
      Source IP: ${alert.sourceIp}
      User Affected: ${alert.userId ? alert.userId.email : "Unknown"}
      Metadata: ${JSON.stringify(alert.metadata)}

      Provide your analysis in the following JSON format:
      {
        "explanation": "A clear explanation of why this is a threat and what the attacker might be trying to do.",
        "recommendation": "Specific, actionable steps for the administrator to take.",
        "confidence": 0.85
      }
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI failed to return valid JSON analysis.");

        const analysis = JSON.parse(jsonMatch[0]);
        analysis.analyzedAt = new Date();

        alert.aiAnalysis = analysis;
        await alert.save();
        if (sourceModel === "SecurityAlert") {
            await securityEventService.ingestFromAlert(alert);
        }

        return sendSuccess(res, 200, "AI analysis generated successfully", { analysis });
    } catch (error) {
        console.error("[AI-Analysis] Error:", error);
        return sendError(res, 500, "AI analysis failed to complete.");
    }
};

const getSecurityAlerts = async (req, res) => {
    try {
        let events = await securityEventService.listRecentEvents(120);

        if (events.length === 0) {
            const legacyAlerts = await SecurityAlert.find()
                .populate("userId", "name email role")
                .sort({ createdAt: -1 })
                .limit(80);
            for (const legacy of legacyAlerts) {
                await securityEventService.ingestFromAlert(legacy);
            }
            events = await securityEventService.listRecentEvents(120);
        }

        const alerts = events.map((event) => ({
            _id: event._id,
            type: event.eventType,
            severity: event.severity,
            status: event.status,
            sourceIp: event.sourceIp,
            description: event.description,
            userId: event.userId || null,
            assetId: event.targetAssetId || null,
            metadata: {
                ...(event.metadata || {}),
                ipType: event.ipType,
                geoConfidence: event.geoConfidence,
                country: event.country,
                city: event.city,
                lat: event.lat,
                lon: event.lon,
                asn: event.asn,
                isp: event.isp,
                org: event.org,
                abuseScore: event.abuseScore,
                intelConfidence: event.intelConfidence
            },
            aiAnalysis: event.aiAnalysis,
            createdAt: event.occurredAt || event.createdAt
        }));

        return sendSuccess(res, 200, "Security alerts fetched successfully", { alerts: alerts || [] });
    } catch (error) {
        console.error("AI Controller Security Alerts Error:", error);
        return sendError(res, 500, "Failed to fetch security alerts", { alerts: "fetch_failed" });
    }
};

module.exports = {
    analyzeAlert,
    getSecurityAlerts
};

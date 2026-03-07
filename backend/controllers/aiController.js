const { GoogleGenerativeAI } = require("@google/generative-ai");
const SecurityAlert = require("../models/SecurityAlert");
const AuditLog = require("../models/AuditLog");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * AI Security Analyst Controller
 * Provides intelligent insights into security alerts and logs.
 */
const analyzeAlert = async (req, res) => {
    try {
        const { alertId } = req.params;
        const alert = await SecurityAlert.findById(alertId).populate("userId", "email role");

        if (!alert) {
            return res.status(404).json({ message: "Security alert not found." });
        }

        // If already analyzed recently, return existing analysis
        if (alert.aiAnalysis && alert.aiAnalysis.explanation && (Date.now() - new Date(alert.aiAnalysis.analyzedAt).getTime() < 24 * 60 * 60 * 1000)) {
            return res.json({ success: true, analysis: alert.aiAnalysis });
        }

        if (!process.env.GEMINI_API_KEY) {
            // Mock fallback if no API key
            const mockAnalysis = {
                explanation: "Gemini API key not configured. This is a placeholder analysis for " + alert.type + ". The pattern suggests unusual activity from IP " + alert.sourceIp + ".",
                recommendation: "Please configure GEMINI_API_KEY in the environment. Recommended manual action: Investigate the source IP and user activity.",
                confidence: 0.5,
                analyzedAt: new Date()
            };
            alert.aiAnalysis = mockAnalysis;
            await alert.save();
            return res.json({ success: true, analysis: mockAnalysis });
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
        "confidence": 0.85 (a number between 0 and 1)
      }
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from the response text (handling potential markdown blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI failed to return valid JSON analysis.");

        const analysis = JSON.parse(jsonMatch[0]);
        analysis.analyzedAt = new Date();

        alert.aiAnalysis = analysis;
        await alert.save();

        res.json({ success: true, analysis });
    } catch (error) {
        console.error("[AI-Analysis] Error:", error);
        res.status(500).json({ message: "AI Analysis failed to complete.", error: error.message });
    }
};

/**
 * Get all security alerts for the SOC dashboard
 */
const getSecurityAlerts = async (req, res) => {
    try {
        const alerts = await SecurityAlert.find()
            .populate("userId", "name email role")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return res.status(200).json(alerts || []);
    } catch (error) {
        console.error("AI Controller Security Alerts Error:", error);
        return res.status(500).json([]);
    }
};

module.exports = {
    analyzeAlert,
    getSecurityAlerts
};

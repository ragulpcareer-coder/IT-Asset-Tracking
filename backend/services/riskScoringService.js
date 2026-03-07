const User = require("../models/User");
const Asset = require("../models/Asset");
const SecurityAlert = require("../models/SecurityAlert");

class RiskScoringService {
    /**
     * Evaluates a security event and proportionally increments the user's risk score and threat level.
     * If the threat level escalates to HIGH or CRITICAL, it fires a realtime SOC Websocket event.
     *
     * @param {string} userId - Target User ObjectId
     * @param {string} eventType - The classification of the anomaly
     * @param {number} baseScore - Fixed risk score points to apply
     */
    async evaluateUserRisk(userId, eventType, baseScore = 0) {
        try {
            let scoreImpact = baseScore;

            // Behavioral Anomaly Taxonomy
            switch (eventType) {
                case "FAILED_LOGIN":
                    scoreImpact += 5;
                    break;
                case "NEW_DEVICE_LOGIN":
                case "SUSPICIOUS_IP":
                    scoreImpact += 15;
                    break;
                case "BRUTE_FORCE_ATTEMPT":
                    scoreImpact += 20;
                    break;
                case "AI_FLAGGED_ANOMALY":
                case "NEW_COUNTRY_LOGIN":
                    scoreImpact += 25;
                    break;
                case "ADMIN_PRIVILEGE_ESCALATION":
                    scoreImpact += 30;
                    break;
            }

            if (scoreImpact === 0) return;

            const user = await User.findById(userId);
            if (!user) return;

            // Extract existing behavioral config or create default
            const currentMeta = user.behavioralMetadata || {};
            let currentScore = currentMeta.riskScore || 0;
            let newScore = Math.min(100, currentScore + scoreImpact);

            // Determine Threat Level based on Enterprise Escalation bands
            let threatLevel = "LOW";
            if (newScore > 30 && newScore <= 60) threatLevel = "MEDIUM";
            else if (newScore > 60 && newScore <= 85) threatLevel = "HIGH";
            else if (newScore > 85) threatLevel = "CRITICAL";

            const previousThreatLevel = currentMeta.threatLevel || "LOW";

            // Inject Updates Back to Model
            await User.updateOne(
                { _id: user._id },
                {
                    $set: {
                        "behavioralMetadata.riskScore": newScore,
                        "behavioralMetadata.threatLevel": threatLevel
                    }
                }
            );

            // Escalate to Global Real-time WebSockets if the Threat climbs
            if (global.io && threatLevel !== previousThreatLevel && (threatLevel === "HIGH" || threatLevel === "CRITICAL")) {
                global.io.emit("security_event", {
                    severity: threatLevel.toLowerCase(),
                    message: `User Threat Escalation: ${user.email} is now classified as ${threatLevel} Risk (Score: ${newScore}). Cause: ${eventType}`,
                    time: new Date()
                });

                // Also persist the escalation to the dedicated system log
                await SecurityAlert.create({
                    type: "ZERO_TRUST_VIOLATION",
                    severity: threatLevel,
                    message: `User Risk Score crossed threshold into ${threatLevel}`,
                    details: `User risk score is now ${newScore} after recent event: ${eventType}`,
                    userId: user._id
                });
            }

            return newScore;

        } catch (err) {
            console.error("[RiskScoringService] Failed to evaluate user risk:", err.message);
        }
    }

    /**
     * Force recalculates an Asset's Risk Level based on live compliance factors
     */
    async evaluateAssetRisk(assetId) {
        try {
            const asset = await Asset.findById(assetId);
            if (!asset) return;

            let vulnerabilityImpact = 0;

            // Conditionals specifically requested by SOC Orchestration constraints
            const hasAntivirusDisabled = asset.softwareConfigurations?.some(sw => sw.name.toLowerCase().includes("antivirus") && sw.status === "disabled");
            if (hasAntivirusDisabled) {
                vulnerabilityImpact += 40;
            }

            const isOsOutdated = asset.osInfo?.release && !asset.osInfo.release.includes("Latest"); // Simulated check
            if (isOsOutdated) vulnerabilityImpact += 30;

            if (asset.vulnerabilities && asset.vulnerabilities.length > 0) {
                vulnerabilityImpact += (asset.vulnerabilities.length * 10);
            }

            asset.activeAlertsScore = vulnerabilityImpact;

            // Mongoose save automatically recalculates exact threat levels via pre('save') hook
            await asset.save();

            return asset.riskScore;
        } catch (err) {
            console.error("[RiskScoringService] Failed to evaluate asset risk:", err.message);
        }
    }
}

module.exports = new RiskScoringService();

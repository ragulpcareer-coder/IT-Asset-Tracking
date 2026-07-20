const Asset = require("../models/Asset");

class RiskScoringService {
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

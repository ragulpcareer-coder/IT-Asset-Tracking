const cron = require("node-cron");
const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");

// Daily lifecycle check at 02:30 AM
cron.schedule("30 2 * * *", async () => {
  try {
    const threshold = new Date();
    threshold.setFullYear(threshold.getFullYear() - 3);

    const assets = await Asset.find({ purchaseDate: { $lte: threshold } });
    if (!assets.length) return;

    for (const asset of assets) {
      asset.securityStatus = asset.securityStatus || {};
      asset.securityStatus.riskLevel = "High";
      asset.securityStatus.remarks = "Lifecycle exceeded: replacement recommended";
      await asset.save();
    }

    await AuditLog.create({
      action: "LIFECYCLE: Replacement Flagged",
      performedBy: "System",
      details: `Flagged ${assets.length} assets older than 3 years for replacement.`,
      ip: "Internal"
    });
  } catch (err) {
    console.warn("[LifecycleJob] Failed:", err.message);
  }
});

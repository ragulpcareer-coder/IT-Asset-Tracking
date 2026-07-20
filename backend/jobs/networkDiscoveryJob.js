const cron = require("node-cron");
const { runNetworkDiscovery } = require("../services/networkDiscoveryService");

const schedule = process.env.NETWORK_DISCOVERY_CRON || "*/5 * * * *";

cron.schedule(schedule, async () => {
  try {
    const io = global.io;
    const result = await runNetworkDiscovery({ io, source: "scheduled" });
    console.log(
      `[Network Discovery] Complete - scanned: ${result.scannedCount}, rogue: ${result.rogueCount}, anomalies: ${result.anomalyWarnings.length}`
    );
  } catch (error) {
    console.error("[Network Discovery] Failed:", error.message);
  }
});


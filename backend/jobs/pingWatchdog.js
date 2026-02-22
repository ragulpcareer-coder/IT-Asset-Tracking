const cron = require('node-cron');
const ping = require('ping');
const Asset = require('../models/Asset');

// Run ping watchdog every 2 minutes
cron.schedule('*/2 * * * *', async () => {
    try {
        console.log('[Ping Watchdog] Starting network discovery and ping check...');

        // Find all assets that have an IP address configured
        const assets = await Asset.find({ ipAddress: { $exists: true, $ne: "" } });

        let onlineCount = 0;
        let offlineCount = 0;

        for (const asset of assets) {
            // Ping the IP
            try {
                const res = await ping.promise.probe(asset.ipAddress, {
                    timeout: 2,
                });

                const wasOnline = asset.networkStatus?.isOnline;
                const isOnlineNow = res.alive;

                // Update asset if status changed or it's been a while
                asset.networkStatus = {
                    isOnline: isOnlineNow,
                    lastSeen: isOnlineNow ? Date.now() : (asset.networkStatus?.lastSeen || null)
                };

                await asset.save();

                if (isOnlineNow) onlineCount++;
                else offlineCount++;

            } catch (err) {
                // Ignore ping errors for individual devices to keep loop running
                console.error(`[Ping Watchdog] Error pinging ${asset.ipAddress}: ${err.message}`);
            }
        }

        console.log(`[Ping Watchdog] Complete. Online: ${onlineCount}, Offline: ${offlineCount}`);

    } catch (error) {
        console.error('[Ping Watchdog] Error running check:', error.message);
    }
});

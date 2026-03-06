const cron = require('node-cron');
const net = require('net'); // Built-in Node.js module — no install needed
const Asset = require('../models/Asset');

/**
 * TCP Port Health Watchdog
 *
 * Replaces ICMP ping (which Render/Vercel/Railway block) with a TCP connection
 * attempt on port 80 (HTTP). A successful TCP handshake means the device is
 * network-reachable and responding.
 *
 * Why TCP instead of ping:
 *   - Cloud platforms (Render, Railway, Fly.io) block ICMP packets at the
 *     network layer — ping.probe() always throws "error executing ping program"
 *   - TCP connect() uses normal outbound sockets which are always allowed
 *   - Port 80 is open on most networked devices (switches, printers, PCs)
 *
 * Port fallback order: 80 → 443 → 22
 * Timeout: 2000ms per attempt
 */

const TCP_PORTS_TO_TRY = [80, 443, 22]; // HTTP, HTTPS, SSH
const TCP_TIMEOUT_MS = 2000;

/**
 * Attempt a TCP connection to ip:port.
 * Resolves true if connected within timeout, false otherwise.
 */
function tcpProbe(ip, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        const done = (result) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(TCP_TIMEOUT_MS);
        socket.on('connect', () => done(true));
        socket.on('error', () => done(false));
        socket.on('timeout', () => done(false));

        socket.connect(port, ip);
    });
}

/**
 * Try multiple ports — returns true if ANY port responds.
 */
async function isReachable(ip) {
    for (const port of TCP_PORTS_TO_TRY) {
        if (await tcpProbe(ip, port)) return true;
    }
    return false;
}

// Run every 2 minutes
cron.schedule('*/2 * * * *', async () => {
    try {
        console.log('[Network Watchdog] Starting TCP health check...');

        const assets = await Asset.find({ ipAddress: { $exists: true, $ne: '' } });

        if (assets.length === 0) {
            console.log('[Network Watchdog] No assets with IP addresses to check.');
            return;
        }

        let onlineCount = 0;
        let offlineCount = 0;

        for (const asset of assets) {
            try {
                const alive = await isReachable(asset.ipAddress);

                asset.networkStatus = {
                    isOnline: alive,
                    lastSeen: alive ? new Date() : (asset.networkStatus?.lastSeen || null),
                };

                // Use updateOne instead of save() to skip pre-save hooks (faster, no re-hash)
                await Asset.updateOne(
                    { _id: asset._id },
                    { $set: { networkStatus: asset.networkStatus } }
                );

                if (alive) onlineCount++;
                else offlineCount++;

            } catch (err) {
                console.error(`[Network Watchdog] Error checking ${asset.ipAddress}: ${err.message}`);
            }
        }

        console.log(`[Network Watchdog] Complete — Online: ${onlineCount}, Offline: ${offlineCount}, Checked: ${assets.length}`);

    } catch (error) {
        console.error('[Network Watchdog] Fatal error:', error.message);
    }
});

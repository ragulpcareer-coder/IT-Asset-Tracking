const axios = require('axios');
const si = require('systeminformation');
const os = require('os');

// Server URL where the agent will report
const SERVER_URL = process.env.SERVER_URL || 'https://it-asset-tracking.onrender.com/api';
// Identifier for this specific device
const SERIAL_NUMBER = process.env.SERIAL_NUMBER || os.hostname();
const SECRET_KEY = process.env.AGENT_SECRET || 'endpoint_agent_secret_key_123!';

async function gatherAndReport() {
    try {
        console.log(`[Agent] Gathering telemetry data for ${SERIAL_NUMBER}...`);

        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const network = await si.networkInterfaces();

        // Find primary IPv4
        let primaryIp = 'Unknown';
        let primaryMac = 'Unknown';
        for (const net of network) {
            if (net.ip4 && !net.internal) {
                primaryIp = net.ip4;
                primaryMac = net.mac;
                break;
            }
        }

        const payload = {
            serialNumber: SERIAL_NUMBER,
            secretKey: SECRET_KEY,
            healthStatus: {
                cpuUsage: cpu.currentLoad.toFixed(2),
                ramTotal: (mem.total / (1024 ** 3)).toFixed(2),
                ramUsed: (mem.active / (1024 ** 3)).toFixed(2),
                ramUsagePercent: ((mem.active / mem.total) * 100).toFixed(2),
            },
            networkStatus: {
                ipAddress: primaryIp,
                macAddress: primaryMac,
                isOnline: true,
                lastSeen: Date.now()
            },
            osInfo: {
                platform: os.platform(),
                release: os.release(),
                hostname: os.hostname(),
            }
        };

        const response = await axios.post(`${SERVER_URL}/assets/agent-report`, payload);
        console.log(`[Agent] Report sent successfully. Status: ${response.status}`);
    } catch (error) {
        console.error(`[Agent] Failed to send report: ${error.message}`);
    }
}

// Run immediately, then every 60 seconds
gatherAndReport();
setInterval(gatherAndReport, 60000);
console.log(`[Agent] Started monitoring. Reporting to ${SERVER_URL} every 60s.`);

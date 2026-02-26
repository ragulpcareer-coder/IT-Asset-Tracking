const axios = require('axios');
const si = require('systeminformation');
const os = require('os');
const crypto = require('crypto');

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
        const processes = await si.processes();
        const connections = await si.networkConnections();
        const uuid = await si.uuid();
        const bios = await si.bios();

        // 1. SIEM Log Normalization: Find primary IPv4
        let primaryIp = 'Unknown';
        let primaryMac = 'Unknown';
        for (const net of network) {
            if (net.ip4 && !net.internal) {
                primaryIp = net.ip4;
                primaryMac = net.mac;
                break;
            }
        }

        // 2. Behavioral Telemetry (§Category 4)
        const criticalProcesses = processes.list
            .filter(p => ['cmd.exe', 'powershell.exe', 'bash', 'ssh', 'scp'].includes(p.name.toLowerCase()))
            .map(p => ({ pid: p.pid, name: p.name, user: p.user, cpu: p.cpu }));

        const suspiciousConnections = connections
            .filter(c => c.state === 'ESTABLISHED' && !['127.0.0.1', '0.0.0.0', '::1'].includes(c.localAddress))
            .map(c => ({ local: `${c.localAddress}:${c.localPort}`, remote: `${c.peerAddress}:${c.peerPort}` }));

        const payload = {
            serialNumber: SERIAL_NUMBER,
            timestamp: Date.now(),
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
                lastSeen: Date.now(),
                establishedConnections: suspiciousConnections.length
            },
            // EDR Telemetry (Category 4)
            edrTelemetry: {
                processCount: processes.all,
                criticalInstances: criticalProcesses,
                networkQuarantine: suspiciousConnections.length > 5, // Threshold for alert
                activeConnections: suspiciousConnections
            },
            hardwareFingerprint: {
                uuid: uuid.os || uuid.macs[0],
                biosSerial: bios.serial
            },
            osInfo: {
                platform: os.platform(),
                release: os.release(),
                hostname: os.hostname(),
            }
        };


        // Create cryptographic HMAC signature for payload authentication
        const signature = crypto.createHmac('sha256', SECRET_KEY)
            .update(JSON.stringify(payload))
            .digest('hex');

        const response = await axios.post(`${SERVER_URL}/assets/agent-report`, payload, {
            headers: { 'x-agent-signature': signature }
        });
        console.log(`[Agent] Report sent successfully. Status: ${response.status}`);
    } catch (error) {
        console.error(`[Agent] Failed to send report: ${error.message}`);
    }
}

// Run immediately, then every 60 seconds
gatherAndReport();
setInterval(gatherAndReport, 60000);
console.log(`[Agent] Started monitoring. Reporting to ${SERVER_URL} every 60s.`);

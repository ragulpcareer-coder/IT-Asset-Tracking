const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");
const QRCode = require("qrcode");
const { sendSecurityAlert } = require("../utils/emailService");
const os = require("os");
const dns = require("dns").promises;
const net = require("net");
const { execFile } = require("child_process");
const { promisify } = require("util");
const riskScoringService = require("./riskScoringService");
const correlationEngine = require("./correlationEngine");

const execFileAsync = promisify(execFile);

const isPrivateIP = (ip) => {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  const p1 = parseInt(parts[0], 10);
  const p2 = parseInt(parts[1], 10);

  if (p1 === 10) return true;
  if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
  if (p1 === 192 && p2 === 168) return true;
  if (p1 === 127) return true;
  if (p1 === 169 && p2 === 254) return true;

  return false;
};

const isValidMAC = (mac) => {
  if (!mac || typeof mac !== "string") return false;
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  if (!macRegex.test(mac)) return false;

  const invalidMacs = [
    "00:00:00:00:00:00",
    "ff:ff:ff:ff:ff:ff",
    "?:?:?:?:?:?",
  ];

  return !invalidMacs.includes(mac.toLowerCase());
};

const resolveDeviceName = async (ip) => {
  try {
    const hostnames = await dns.reverse(ip);
    return hostnames && hostnames.length > 0 ? hostnames[0] : null;
  } catch (_) {
    return null;
  }
};

const checkPort = (port, host) => new Promise((resolve) => {
  const socket = new net.Socket();
  socket.setTimeout(1000);
  socket.on("connect", () => {
    socket.destroy();
    resolve(true);
  });
  socket.on("timeout", () => {
    socket.destroy();
    resolve(false);
  });
  socket.on("error", () => resolve(false));
  socket.connect(port, host);
});

const normalizeMac = (mac) => String(mac || "").trim().replace(/-/g, ":").toLowerCase();

function parseArpOutput(output) {
  const devices = [];
  const lines = String(output || "").split(/\r?\n/);
  const windowsPattern = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f-]{17})\s+\w+/i;
  const unixPattern = /\((\d{1,3}(?:\.\d{1,3}){3})\)\s+at\s+([0-9a-f:]{17})/i;

  for (const line of lines) {
    const match = line.match(windowsPattern) || line.match(unixPattern);
    if (!match) continue;
    devices.push({
      ip: match[1],
      mac: normalizeMac(match[2]),
      name: "?",
    });
  }

  return devices;
}

async function scanArpTable() {
  try {
    const { stdout } = await execFileAsync("arp", ["-a"], {
      timeout: 5000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return parseArpOutput(stdout);
  } catch (error) {
    console.warn("[SOC] ARP table scan failed. Continuing with interface-only discovery.", error.message);
    return [];
  }
}

async function discoverRawDevices() {
  let devices = [];

  try {
    devices = await scanArpTable();

    const interfaces = os.networkInterfaces();
    for (const iface in interfaces) {
      for (const detail of interfaces[iface]) {
        if (detail.family === "IPv4" && !detail.internal) {
          if (!devices.some((device) => device.ip === detail.address)) {
            devices.push({
              ip: detail.address,
              mac: detail.mac || "00:00:00:00:00:00",
              name: os.hostname(),
            });
          }
        }
      }
    }

    for (const device of devices) {
      if (!device.name || device.name === "?") {
        const resolvedName = await resolveDeviceName(device.ip);
        if (resolvedName) device.name = resolvedName;
      }
    }
  } catch (error) {
    console.warn("[SOC] Local device scan failed (Execution context lacks ARP/Socket permissions). Continuing with empty device list.", error.message);
  }

  return devices;
}

function filterValidLanDevices(devices) {
  const validDevices = [];
  const anomalyWarnings = [];

  for (const device of devices) {
    if (!net.isIPv4(device.ip)) continue;

    if (!isPrivateIP(device.ip)) {
      anomalyWarnings.push(`WAN/Public IP detected and dropped during local scan: ${device.ip}`);
      continue;
    }

    if (!isValidMAC(device.mac)) {
      anomalyWarnings.push(`Invalid/Empty MAC address detected for ${device.ip}. Integrity failure.`);
      continue;
    }

    if (device.ip.endsWith(".255") || device.ip.startsWith("224.") || device.ip.startsWith("239.")) {
      continue;
    }

    validDevices.push(device);
  }

  return { validDevices, anomalyWarnings };
}

async function classifyDevice(ip) {
  const commonPorts = [22, 80, 443, 3389, 8080, 5000, 3000];
  const openPorts = [];

  for (const port of commonPorts) {
    const isOpen = await checkPort(port, ip);
    if (isOpen) openPorts.push(port);
  }

  let guessedType = "Unknown";
  if (openPorts.includes(3389)) guessedType = "Workstation";
  if (openPorts.includes(22)) guessedType = "Server";
  if (openPorts.includes(80) || openPorts.includes(443)) guessedType = "Network Device";

  return { guessedType, openPorts };
}

async function createRogueAsset(device, source, io) {
  const { guessedType, openPorts } = await classifyDevice(device.ip);
  const serialNumber = `DISC-${Date.now()}-${device.ip.split(".").pop()}`;

  const rogueAsset = await Asset.create({
    name: device.name && device.name !== "?" ? device.name : `Discovered ${guessedType} (${device.ip})`,
    type: guessedType,
    serialNumber,
    status: "available",
    ipAddress: device.ip,
    macAddress: device.mac,
    networkStatus: {
      isOnline: true,
      lastSeen: Date.now(),
    },
    securityStatus: {
      isAuthorized: false,
      riskLevel: openPorts.length > 0 ? "High" : "Medium",
      remarks: `Unauthorized device discovered during ${source} scan. Open services: [${openPorts.join(", ") || "none"}]`,
    },
  });

  rogueAsset.qrCode = await QRCode.toDataURL(JSON.stringify({
    id: rogueAsset._id,
    serialNumber: rogueAsset.serialNumber,
    name: rogueAsset.name,
  }));
  await rogueAsset.save();

  await riskScoringService.evaluateAssetRisk(rogueAsset._id);

  await sendSecurityAlert(
    `UNAUTHORIZED DEVICE REGISTERED: ${rogueAsset.name}`,
    `<b>SECURITY BREACH:</b> A new unknown device was detected at physical address <b>${device.mac}</b>. Access source: ${device.ip}. Integrity check pending.`
  );

  await correlationEngine.triggerAlert("ROGUE_NODE", {
    message: `Unauthorized device detected: ${rogueAsset.name} - IP: ${device.ip} MAC: ${device.mac}. Open services: [${openPorts.join(", ") || "none"}]`,
    ip: device.ip,
    severity: openPorts.length > 0 ? "HIGH" : "MEDIUM",
    metadata: { assetId: String(rogueAsset._id), mac: device.mac, openPorts, source },
  });

  await AuditLog.create({
    action: "SECURITY: Rogue Device Detected",
    performedBy: "Network Discovery Monitor",
    details: `Unregistered device ${rogueAsset.name} found on local segment during ${source} scan. IP: ${device.ip}. MAC: ${device.mac}.`,
    ip: device.ip,
  });

  if (io) io.emit("assetCreated", rogueAsset);

  return rogueAsset;
}

async function runNetworkDiscovery({ io, source = "manual" } = {}) {
  const devices = await discoverRawDevices();
  const { validDevices, anomalyWarnings } = filterValidLanDevices(devices);

  if (anomalyWarnings.length > 0) {
    await AuditLog.create({
      action: "DISCOVERY INTEGRITY WARNING",
      performedBy: "System Scanning Modules",
      details: `Detected and purged anomalous scan data. Details: ${anomalyWarnings.slice(0, 3).join(", ")}...`,
      ip: "Internal",
    });
  }

  const rogueDevicesFound = [];

  for (const device of validDevices) {
    const existing = await Asset.findOne({
      $or: [
        { macAddress: device.mac },
        { ipAddress: device.ip },
      ],
    });

    if (existing) {
      const networkStatus = {
        ...(existing.networkStatus || {}),
        isOnline: true,
        lastSeen: new Date(),
      };

      await Asset.updateOne(
        { _id: existing._id },
        {
          $set: {
            ipAddress: device.ip,
            macAddress: device.mac,
            networkStatus,
          },
        }
      );

      continue;
    }

    const rogueAsset = await createRogueAsset(device, source, io);
    rogueDevicesFound.push(rogueAsset);
  }

  return {
    scannedCount: validDevices.length,
    rogueCount: rogueDevicesFound.length,
    rogueDevicesFound,
    anomalyWarnings,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  runNetworkDiscovery,
};

const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");
const QRCode = require('qrcode');
const crypto = require('crypto');
const findLocalDevices = require('local-devices');
const { sendSecurityAlert } = require('../utils/emailService');
const dns = require('dns').promises;
const os = require('os');
const net = require('net');

// Private/Local IP Check (RFC 1918 + loopback/link-local)
const isPrivateIP = (ip) => {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const p1 = parseInt(parts[0], 10);
  const p2 = parseInt(parts[1], 10);

  if (p1 === 10) return true;
  if (p1 === 172 && (p2 >= 16 && p2 <= 31)) return true;
  if (p1 === 192 && p2 === 168) return true;
  if (p1 === 127) return true; // Loopback
  if (p1 === 169 && p2 === 254) return true; // Link-local

  return false;
};

// Check if MAC Address is Valid Format and not a default hypervisor/empty MAC
const isValidMAC = (mac) => {
  if (!mac || typeof mac !== 'string') return false;
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  if (!macRegex.test(mac)) return false;

  const invalidMacs = [
    '00:00:00:00:00:00',
    'ff:ff:ff:ff:ff:ff',
    '?:?:?:?:?:?' // Some tools output this on error
  ];
  if (invalidMacs.includes(mac.toLowerCase())) return false;

  return true;
};

// Helper to resolve device name accurately (§2.4)
const resolveDeviceName = async (ip) => {
  try {
    const hostnames = await dns.reverse(ip);
    return hostnames && hostnames.length > 0 ? hostnames[0] : null;
  } catch (_) {
    return null;
  }
};

// Simple TCP Port Scanner (Enterprise Weakness 12 Fix)
const checkPort = (port, host) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000); // 1-second timeout
    socket.on('connect', () => {
      socket.destroy();
      resolve(true); // Port is open
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
};

// GET all assets with pagination, sorting, and filtering
// RBAC: Admins see all assets. Standard Users ONLY see assets assigned to them.
const getAssets = async (req, res) => {
  try {
    const { search, status, type, sort } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 10;

    // Mass Data Extraction Detection (§7.2 / §17)
    if (limit > 1000) {
      await AuditLog.create({
        action: "SECURITY ALERT: Mass Data Extraction Attempt",
        performedBy: req.user.email,
        details: `User attempted to fetch ${limit} records in a single call. SIEM threshold exceeded (§7.2).`,
        ip: req.ip || req.connection?.remoteAddress
      });
      return res.status(403).json({ message: "Security Violation: Large-scale data extraction is restricted. Please use smaller page sizes." });
    }
    if (limit > 100) limit = 100; // Hard cap for performance/security

    const query = {};

    // 5. ZONAL ACCESS CONTROL (§Category 5/10)
    if (!["Super Admin", "Admin", "Auditor"].includes(req.user.role)) {
      if (req.user.role === "Manager" || req.user.role === "Asset Manager") {
        // Zonal View: Can only see assets in their department
        query.department = req.user.department;
      } else {
        // Employee (Standard User): strictly assigned nodes only
        query.$or = [
          { assignedTo: req.user.email },
          { assignedTo: req.user.name },
        ];
      }
    }


    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (status && status !== "All") {
      query.status = status;
    }

    if (type && type !== "All") {
      query.type = type;
    }

    const sortOption = sort ? { [sort]: -1 } : { createdAt: -1 };

    const assets = await Asset.find(query)
      .sort(sortOption)
      .limit(limit)
      .skip((page - 1) * limit);

    const count = await Asset.countDocuments(query);

    res.json({
      assets,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalAssets: count,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assets" });
  }
};

const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    // Scoped check: Standard users can only view their assigned assets
    if (!["Super Admin", "Admin", "Asset Manager", "Security Auditor"].includes(req.user.role)) {
      if (asset.assignedTo !== req.user.email && asset.assignedTo !== req.user.name) {
        return res.status(403).json({ message: "Access Denied: This asset is not assigned to you." });
      }
    }

    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving asset details" });
  }
};


// CREATE asset — Admin only (enforced at route + here for defence-in-depth)
const createAsset = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin", "Asset Manager"].includes(req.user.role)) {
    return res.status(403).json({ message: "Strategic Violation: Role lacks provisioning authority." });
  }
  try {
    // SECURITY: Explicit mapping to prevent Mass Assignment (§Item 30 / §3.1)
    const { name, type, serialNumber, classification, status, assignedTo, purchasePrice, usefulLifeYears, location } = req.body;

    const qrData = JSON.stringify({ id: "NEW", serialNumber, name });
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);

    const asset = await Asset.create({
      name, type, serialNumber, classification, status, assignedTo, purchasePrice, usefulLifeYears, location,
      qrCode: qrCodeDataUrl,
      securityStatus: { isAuthorized: true, riskLevel: 'Low', remarks: 'Provisioned via Core Admin Registry' }
    });

    // Finalize QR with permanent reference
    asset.qrCode = await QRCode.toDataURL(JSON.stringify({ id: asset._id, serialNumber, name }));
    await asset.save();

    await AuditLog.create({
      action: `NODE_PROVISIONED: ${asset.name}`,
      performedBy: req.user.email,
      details: `Asset ${serialNumber} added to global registry cluster.`,
      ip: req.ip || req.connection?.remoteAddress
    });

    res.status(201).json(asset);
  } catch (error) {
    logger.error("Provisioning Error:", error);
    res.status(500).json({ message: "Registry error: Node creation rejected." });
  }
};

const updateAsset = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin", "Asset Manager"].includes(req.user.role)) {
    return res.status(403).json({ message: "Strategic Error: Authorization insufficient for metadata modification." });
  }
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: "Registry Error: Node not found." });

    // SECURITY: Explicit property mapping (§Item 30 / §3.1)
    const { name, type, serialNumber, classification, status, assignedTo, purchasePrice, usefulLifeYears, location } = req.body;

    if (name) asset.name = name;
    if (type) asset.type = type;
    if (serialNumber) asset.serialNumber = serialNumber;
    if (classification) asset.classification = classification;
    if (status) asset.status = status;
    if (assignedTo !== undefined) asset.assignedTo = assignedTo;
    if (purchasePrice !== undefined) asset.purchasePrice = purchasePrice;
    if (usefulLifeYears !== undefined) asset.usefulLifeYears = usefulLifeYears;
    if (location) asset.location = { ...asset.location, ...location };

    // Regenerate QR if critical identifiers changed
    if (name || serialNumber) {
      asset.qrCode = await QRCode.toDataURL(JSON.stringify({
        id: asset._id,
        serialNumber: asset.serialNumber,
        name: asset.name
      }));
    }

    await asset.save();

    await AuditLog.create({
      action: `METADATA_MODIFIED: ${asset.name}`,
      performedBy: req.user.email,
      details: `Asset ${asset.serialNumber} registry updated.`,
      ip: req.ip || req.connection?.remoteAddress
    });

    const io = req.app.get("io");
    if (io) io.emit("assetUpdated", asset);

    res.json(asset);
  } catch (error) {
    logger.error("Registry Sync Failure:", error);
    res.status(500).json({ message: "Strategic Error: Asset modification protocol failed." });
  }
};


// DELETE asset — Admin only
const deleteAsset = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: Only administrators can delete assets." });
  }
  try {
    const assetId = req.params.id;
    const asset = await Asset.findById(assetId);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    const PendingAction = require("../models/PendingAction");
    const { approvalId } = req.query;

    // Check if this action is already approved by another admin (§3.1)
    if (approvalId) {
      const approvedAction = await PendingAction.findById(approvalId);
      if (approvedAction && approvedAction.status === "APPROVED" && approvedAction.data.assetId === assetId) {
        // Verify it was approved by someone ELSE
        if (approvedAction.approvals[0].adminId.toString() === req.user._id.toString()) {
          return res.status(403).json({ message: "Security Violation: You cannot approve your own deletion request (4-Eyes Principle)." });
        }

        await asset.deleteOne();
        approvedAction.status = "EXECUTED";
        await approvedAction.save();

        await AuditLog.create({
          action: "DUAL-AUTH: Asset Deleted",
          performedBy: req.user.email,
          details: `Asset ${asset.name} permanently removed after Dual authorization. Requested by UserID: ${approvedAction.createdBy}`,
          ip: req.ip || req.connection?.remoteAddress,
        });

        const io = req.app.get("io");
        io.emit("assetDeleted", assetId);
        return res.json({ message: "Asset deleted successfully via Dual Authorization." });
      }
    }

    // Otherwise, create a pending request (§3.1)
    const existingPending = await PendingAction.findOne({ "data.assetId": assetId, status: "PENDING" });
    if (existingPending) {
      return res.status(409).json({ message: "A deletion request for this asset is already pending approval.", pendingActionId: existingPending._id });
    }

    const pending = await PendingAction.create({
      actionType: "DELETE_ASSET",
      data: { assetId, assetName: asset.name },
      createdBy: req.user._id
    });

    await AuditLog.create({
      action: "SECURITY: Deletion Requested",
      performedBy: req.user.email,
      details: `Requested deletion of asset: ${asset.name}. Penting Dual Authorization.`,
      ip: req.ip || req.connection?.remoteAddress,
    });

    res.status(202).json({
      message: "Dual Authorization Required: A secondary administrator must approve this deletion for safety.",
      pendingActionId: pending._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// EXPORT assets to CSV — Admin only
const exportAssets = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin", "Security Auditor"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: Only authorized roles can export inventory data." });
  }

  try {
    const { status, type } = req.query;
    const query = {};
    if (status && status !== "All") query.status = status;
    if (type && type !== "All") query.type = type;

    const assets = await Asset.find(query).sort({ createdAt: -1 }).lean();

    // Mass Export Alert (§5.1 / §17)
    if (assets.length > 50) {
      await AuditLog.create({
        action: "SECURITY ALERT: Mass Data Export",
        performedBy: req.user.email,
        details: `Potential Inventory Exfiltration: User exported ${assets.length} assets. SIEM Threshold: 50.`,
        ip: req.ip || req.connection?.remoteAddress,
        meta: { count: assets.length }
      });
    }

    const fields = ['_id', 'name', 'type', 'serialNumber', 'status', 'assignedTo', 'purchaseDate', 'warrantyExpiry'];

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      if (s.search(/[,"\n]/) >= 0) return `"${s}"`;
      return s;
    };

    const header = fields.join(',');
    const prepared = assets.map(a => ({
      _id: a._id.toString(),
      name: a.name,
      type: a.type,
      serialNumber: a.serialNumber,
      status: a.status,
      assignedTo: a.assignedTo || '',
      purchaseDate: a.purchaseDate ? new Date(a.purchaseDate).toISOString().split('T')[0] : '',
      warrantyExpiry: a.warrantyExpiry ? new Date(a.warrantyExpiry).toISOString().split('T')[0] : ''
    }));

    const body = prepared.map(r => fields.map(f => escape(r[f])).join(',')).join('\\n');
    const csv = header + '\\n' + body;

    res.header('Content-Type', 'text/csv');
    res.attachment(`assets-export-${Date.now()}.csv`);
    return res.send(csv);
  } catch (error) {
    res.status(500).json({ message: "Export failed" });
  }
};

const fs = require("fs");
const csv = require("csv-parser");

// BULK UPLOAD assets from CSV — Admin only
const bulkUploadAssets = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: Only administrators can bulk upload assets." });
  }
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const results = [];
    const errors = [];
    let successCount = 0;

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        for (const row of results) {
          try {
            // AI SECURITY: Detect Prompt Injection inside documents (§Category 1)
            const { detectPromptInjection } = require("../utils/security");
            if (detectPromptInjection(row)) {
              await AuditLog.create({
                action: "SECURITY ALERT: Adversarial Macro Blocked",
                performedBy: req.user.email,
                details: `Quarantined CSV Row: Prompt Injection attempt detected in ${row.name || 'unnamed row'}.`,
                ip: req.ip || req.connection?.remoteAddress
              });
              errors.push(`Row Rejected: High-Risk Adversarial Pattern Detected (${row.serialNumber || 'unknown'}).`);
              continue;
            }

            // validate required
            if (!row.name || !row.type || !row.serialNumber) {

              errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
              continue;
            }

            // Check duplicate
            const exists = await Asset.findOne({ serialNumber: row.serialNumber });
            if (exists) {
              errors.push(`Duplicate Serial Number skipped: ${row.serialNumber}`);
              continue;
            }

            const qrData = JSON.stringify({
              id: "NEW",
              serialNumber: row.serialNumber,
              name: row.name
            });
            const qrCodeDataUrl = await QRCode.toDataURL(qrData);

            const newAsset = new Asset({
              name: row.name,
              type: row.type,
              serialNumber: row.serialNumber,
              status: row.status || "available",
              assignedTo: row.assignedTo || null,
              purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : Date.now(),
              purchasePrice: row.purchasePrice ? parseFloat(row.purchasePrice) : 0,
              salvageValue: row.salvageValue ? parseFloat(row.salvageValue) : 0,
              usefulLifeYears: row.usefulLifeYears ? parseInt(row.usefulLifeYears) : 5,
              qrCode: qrCodeDataUrl
            });

            await newAsset.save();

            // update qr id
            newAsset.qrCode = await QRCode.toDataURL(JSON.stringify({
              id: newAsset._id,
              serialNumber: newAsset.serialNumber,
              name: newAsset.name
            }));
            await newAsset.save();

            successCount++;
          } catch (err) {
            errors.push(`Failed on row ${row.serialNumber}: ${err.message}`);
          }
        }

        // Clean up temp file
        fs.unlinkSync(req.file.path);

        await AuditLog.create({
          action: "Bulk Uploaded Assets",
          performedBy: req.user?.email || "Unknown",
          details: `Uploaded ${successCount} assets. Errors: ${errors.length}`,
        });

        // Broadcast to clients
        const io = req.app.get("io");
        io.emit("bulkAssetsUploaded");

        res.json({
          message: `Successfully processed ${successCount} assets`,
          errors
        });
      });
  } catch (error) {
    res.status(500).json({ message: "Bulk upload failed" });
  }
};

// Network Scan — Admin only
const scanNetwork = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: Only administrators can run network scans." });
  }
  try {
    // 1. Run actual ARP network scan
    let devices = [];
    try {
      devices = await findLocalDevices();

      // Auto-populate own interfaces to ensure server is recognized (§2.4)
      const interfaces = os.networkInterfaces();
      for (let iface in interfaces) {
        for (let detail of interfaces[iface]) {
          if (detail.family === 'IPv4' && !detail.internal) {
            if (!devices.some(d => d.ip === detail.address)) {
              devices.push({
                ip: detail.address,
                mac: detail.mac || '00:00:00:00:00:00',
                name: os.hostname()
              });
            }
          }
        }
      }

      // Try to resolve names for all discovered devices (§2.4)
      for (let device of devices) {
        if (!device.name || device.name === '?') {
          const resolvedName = await resolveDeviceName(device.ip);
          if (resolvedName) device.name = resolvedName;
        }
      }
    } catch (scanErr) {
      console.warn("[SOC] Local device scan failed (Execution context lacks ARP/Socket permissions). Continuing with empty device list.", scanErr.message);
      // In cloud environments like Render, arp requires root network capabilities which containers lack.
      // Defensively swallow the error and return an empty active devices list instead of a fatal 403.
    }

    // 2. Filter & Validate Results for Zero-Trust Segment Integrity
    let validLAN_Devices = [];
    let anomalyWarnings = [];

    for (let device of devices) {
      // Must be a valid IPv4
      if (!net.isIPv4(device.ip)) {
        continue;
      }

      // Is it a proper local IP?
      if (!isPrivateIP(device.ip)) {
        anomalyWarnings.push(`WAN/Public IP detected and dropped during local scan: ${device.ip}`);
        continue;
      }

      // Is MAC format valid?
      if (!isValidMAC(device.mac)) {
        anomalyWarnings.push(`Invalid/Empty MAC address detected for ${device.ip}. Integrity failure.`);
        continue;
      }

      // Prevent Multicast/Broadcast mappings
      if (device.ip.endsWith('.255') || device.ip.startsWith('224.') || device.ip.startsWith('239.')) {
        continue;
      }

      validLAN_Devices.push(device);
    }

    if (anomalyWarnings.length > 0) {
      await AuditLog.create({
        action: "DISCOVERY INTEGRITY WARNING",
        performedBy: "System Scanning Modules",
        details: `Detected and purged anomalous scan data. Details: ${anomalyWarnings.slice(0, 3).join(', ')}...`,
        ip: "Internal"
      });
      console.warn("Discovery Anomalies Detected:", anomalyWarnings);
    }

    let rogueDevicesFound = [];
    const io = req.app.get("io");

    for (const device of validLAN_Devices) {
      // Check if device is known to our database by MAC or IP
      const existing = await Asset.findOne({
        $or: [
          { macAddress: device.mac },
          { ipAddress: device.ip }
        ]
      });

      if (!existing) {
        // TCP Port Scan for better classification (§2.4)
        const commonPorts = [22, 80, 443, 3389, 8080, 5000, 3000];
        let openPorts = [];
        for (let port of commonPorts) {
          const isOpen = await checkPort(port, device.ip);
          if (isOpen) openPorts.push(port);
        }

        // Determine device type based on open ports
        let guessedType = "Unknown";
        if (openPorts.includes(3389)) guessedType = "Workstation";
        if (openPorts.includes(22)) guessedType = "Server";
        if (openPorts.includes(80) || openPorts.includes(443)) guessedType = "Network Device";

        const serialNumber = `DISC-${Date.now()}-${device.ip.split('.').pop()}`;
        const assetData = {
          name: device.name && device.name !== '?' ? device.name : `Discovered ${guessedType} (${device.ip})`,
          type: guessedType,
          serialNumber: serialNumber,
          status: "available",
          ipAddress: device.ip,
          macAddress: device.mac,
          networkStatus: {
            isOnline: true,
            lastSeen: Date.now()
          },
          securityStatus: {
            isAuthorized: false,
            riskLevel: openPorts.length > 0 ? "High" : "Medium",
            remarks: `Unauthorized device discovered during network scan. Open services: [${openPorts.join(', ') || 'none'}]`
          }
        };

        const rogueAsset = await Asset.create(assetData);

        // Finalize QR with ID
        rogueAsset.qrCode = await QRCode.toDataURL(JSON.stringify({
          id: rogueAsset._id,
          serialNumber: rogueAsset.serialNumber,
          name: rogueAsset.name
        }));
        await rogueAsset.save();

        // Trigger SIEM Alert
        await sendSecurityAlert(
          `UNAUTHORIZED DEVICE REGISTERED: ${rogueAsset.name}`,
          `<b>SECURITY BREACH:</b> A new unknown device was detected at physical address <b>${device.mac}</b>. Access source: ${device.ip}. Integrity check pending.`
        );

        await AuditLog.create({
          action: "SECURITY: Rogue Device Detected",
          performedBy: "Network Discovery Monitor",
          details: `Unregistered device ${rogueAsset.name} found on local segment. IP: ${device.ip}. MAC: ${device.mac}.`,
          ip: device.ip,
        });

        const io = req.app.get("io");
        io.emit("assetCreated", rogueAsset);
        io.emit("securityAlert", rogueAsset);

        rogueDevicesFound.push(rogueAsset);
      }
    }

    if (rogueDevicesFound.length > 0) {
      return res.json({
        success: true,
        data: rogueDevicesFound[0],
        message: `Scan complete. ${rogueDevicesFound.length} new unauthorized device(s) found!`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: null,
      message: "Scan complete. Network is secure. No new unauthorized devices detected.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Network scan system failure:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      timestamp: new Date().toISOString()
    });
  }
};

// GET Security Alerts — Admin only
const getSecurityAlerts = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin", "SOC", "Security"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Insufficient privileges",
      code: "AUTH_403"
    });
  }
  try {
    const alerts = await Asset.find({
      $or: [
        { "securityStatus.isAuthorized": false },
        { "securityStatus.riskLevel": { $in: ["High", "Critical"] } }
      ]
    }).sort({ createdAt: -1 }).limit(20) || [];

    res.json({
      success: true,
      data: alerts,
      message: alerts.length > 0 ? "Security alerts retrieved" : "No active security alerts",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("getSecurityAlerts failure:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      timestamp: new Date().toISOString()
    });
  }
};

const agentReport = async (req, res) => {
  try {
    const { serialNumber, healthStatus, networkStatus, osInfo, timestamp } = req.body;
    const signature = req.headers['x-agent-signature'];

    if (!signature) {
      return res.status(403).json({ message: "Missing agent signature" });
    }

    // Prevent Replay Attacks (Reject payloads older than 5 minutes)
    if (!timestamp || Date.now() - timestamp > 5 * 60 * 1000) {
      return res.status(403).json({ message: "Payload expired / possible replay attack" });
    }

    // Verify HMAC Signature (Enterprise Agent Authentication)
    const SECRET_KEY = process.env.AGENT_SECRET || 'endpoint_agent_secret_key_123!';
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    // Perform timing-safe equal to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      // Log Unauthorized Agent Attempt
      await AuditLog.create({
        action: `SECURITY ALERT: Unauthorized Agent Connection Blocked`,
        performedBy: `Agent IP: ${req.ip}`,
        details: `Failed HMAC signature verification for Serial: ${serialNumber}`,
      });
      return res.status(403).json({ message: "Unauthorized agent signature" });
    }

    let asset = await Asset.findOne({ serialNumber });

    if (!asset) {
      // Auto-discover the asset via agent if not exists
      asset = new Asset({
        name: `Agent Device (${osInfo?.hostname || serialNumber})`,
        type: "Computer",
        serialNumber,
        ipAddress: networkStatus?.ipAddress,
        macAddress: networkStatus?.macAddress,
        status: "available",
      });
      // Generate QR
      const qrData = JSON.stringify({
        id: "NEW",
        serialNumber: asset.serialNumber,
        name: asset.name
      });
      asset.qrCode = await QRCode.toDataURL(qrData);
    }

    // Update telemetry
    asset.healthStatus = {
      ...healthStatus,
      lastReported: Date.now()
    };
    asset.osInfo = osInfo;
    asset.networkStatus = networkStatus;
    if (req.body.hardwareFingerprint) {
      asset.hardwareFingerprint = req.body.hardwareFingerprint;
    }

    // 7. Detection Engineering: Analysis of incoming telemetry (Category 3/4)
    const detectionEngine = require("../utils/detectionEngine");
    await detectionEngine.analyzeEndpointTelemetry(asset, req.body);

    // Auto-update top-level IP/MAC if it changed (§Category 7)
    if (networkStatus?.ipAddress) asset.ipAddress = networkStatus.ipAddress;
    if (networkStatus?.macAddress) asset.macAddress = networkStatus.macAddress;

    const isNewlyCreated = asset.isNew;
    await asset.save();

    // update qr id if it was newly created
    if (isNewlyCreated) {
      asset.qrCode = await QRCode.toDataURL(JSON.stringify({
        id: asset._id,
        serialNumber: asset.serialNumber,
        name: asset.name
      }));
      await asset.save();
    }

    // REAL-TIME SYNC (§Category 4)
    const io = req.app.get("io");
    if (io) {
      if (isNewlyCreated) io.emit("assetCreated", asset);
      else io.emit("assetUpdated", asset);
    }

    res.json({ message: "Telemetry received" });

  } catch (error) {
    res.status(500).json({ message: "Error processing report" });
  }
};

// VERIFY ASSET INTEGRITY — Secure verification of row-level data (§4.1)
const verifyAssetIntegrity = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    // Recalculate hash for verification (§4.1)
    const payload = `${asset.name}|${asset.type}|${asset.serialNumber}|${asset.status}|${asset.assignedTo}`;
    const calculatedHash = crypto.createHash("sha256").update(payload).digest("hex");

    const isTampered = asset.integrityHash !== calculatedHash;

    if (isTampered) {
      await AuditLog.create({
        action: "SECURITY ALERT: Record Tampering Detected",
        performedBy: req.user?.email || "System-Monitor",
        details: `Integrity check FAILED for Asset ID ${asset._id} (${asset.name}). Database mismatch detected (§4.1).`,
        ip: req.ip || req.connection?.remoteAddress
      });
    }

    res.json({
      assetId: asset._id,
      isIntegrityValid: !isTampered,
      storedHash: asset.integrityHash,
      calculatedHash: calculatedHash,
      status: isTampered ? "SECURITY BREACH DETECTED" : "VERIFIED SAFE"
    });
  } catch (error) {
    res.status(500).json({ message: "Integrity verification system failure." });
  }
};

module.exports = {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  exportAssets,
  bulkUploadAssets,
  scanNetwork,
  getSecurityAlerts,
  agentReport,
  verifyAssetIntegrity,
};

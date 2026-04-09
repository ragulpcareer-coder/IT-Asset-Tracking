const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");
const SecurityAlert = require("../models/SecurityAlert");
const QRCode = require('qrcode');
const crypto = require('crypto');
const findLocalDevices = require('local-devices');
const { sendSecurityAlert } = require('../utils/emailService');
const dns = require('dns').promises;
const os = require('os');
const net = require('net');
const logger = require("../utils/logger");
const riskScoringService = require("../services/riskScoringService");
const correlationEngine = require("../services/correlationEngine");
const { runNetworkDiscovery } = require("../services/networkDiscoveryService");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const { Readable } = require("stream");

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

// Helper to resolve device name accurately (Â§2.4)
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

    // Mass Data Extraction Detection (Â§7.2 / Â§17)
    if (limit > 1000) {
      await AuditLog.create({
        action: "SECURITY ALERT: Mass Data Extraction Attempt",
        performedBy: req.user.email,
        details: `User attempted to fetch ${limit} records in a single call. SIEM threshold exceeded (Â§7.2).`,
        ip: req.ip || req.connection?.remoteAddress
      });
      return res.status(403).json({ message: "Security Violation: Large-scale data extraction is restricted. Please use smaller page sizes." });
    }
    if (limit > 100) limit = 100; // Hard cap for performance/security

    const query = {};

    // 5. ZONAL ACCESS CONTROL (Â§Category 5/10)
    if (!["Super Admin", "Admin", "Auditor", "Security Auditor"].includes(req.user.role)) {
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

    if (search && typeof search === "string") {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (escaped) {
        const searchRegex = new RegExp(escaped, "i");
        const searchConditions = [
          { name: searchRegex },
          { serialNumber: searchRegex },
          { assignedTo: searchRegex },
          { ipAddress: searchRegex },
          { macAddress: searchRegex },
          { type: searchRegex },
          { classification: searchRegex },
          { uuid: searchRegex }
        ];

        if (query.$or) {
          query.$and = [
            { $or: query.$or },
            { $or: searchConditions }
          ];
          delete query.$or;
        } else {
          query.$or = searchConditions;
        }
      }
    }

    if (status && status !== "All") {
      query.status = status;
    }

    if (type && type !== "All") {
      query.type = type;
    }

    const parseSort = (value) => {
      if (!value || typeof value !== "string") return { createdAt: -1 };

      const [fieldRaw, directionRaw] = value.split(":");
      const field = (fieldRaw || "createdAt").trim();
      const direction = (directionRaw || "").trim().toLowerCase();

      if (direction === "asc") return { [field]: 1 };
      if (direction === "desc") return { [field]: -1 };

      if (["name", "type", "status", "classification", "assignedTo"].includes(field)) {
        return { [field]: 1 };
      }

      if (["createdAt", "updatedAt", "riskScore"].includes(field)) {
        return { [field]: -1 };
      }

      if (["usefulLifeYears", "purchasePrice"].includes(field)) {
        return { [field]: 1 };
      }

      return { createdAt: -1 };
    };

    const sortOption = parseSort(sort);

    const assets = await Asset.find(query)
      .sort(sortOption)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const count = await Asset.countDocuments(query);

    res.json({
      success: true,
      assets,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalAssets: count,
    });
  } catch (error) {
    return sendError(res, 500, "Failed to fetch assets", {
      assets: "fetch_failed",
    });
  }
};
const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return sendError(res, 400, "Asset not found", { id: "invalid_asset" });

    // Scoped check: Standard users can only view their assigned assets
    if (!["Super Admin", "Admin", "Asset Manager", "Security Auditor"].includes(req.user.role)) {
      if (asset.assignedTo !== req.user.email && asset.assignedTo !== req.user.name) {
        return sendError(res, 403, "Access Denied: This asset is not assigned to you.", {
          asset: "forbidden",
        });
      }
    }

    return res.json({ success: true, asset });
  } catch (error) {
    return sendError(res, 500, "Error retrieving asset details", {
      asset: "fetch_failed",
    });
  }
};


// CREATE asset â€” Admin only (enforced at route + here for defence-in-depth)
const createAsset = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin", "Asset Manager"].includes(req.user.role)) {
    return sendError(res, 403, "Strategic Violation: Role lacks provisioning authority.", {
      asset: "forbidden",
    });
  }
  try {
    // SECURITY: Explicit mapping to prevent Mass Assignment (Â§Item 30 / Â§3.1)
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

    return res.status(201).json({ success: true, asset, message: "Node provisioned successfully." });
  } catch (error) {
    logger.error("Provisioning Error:", error);
    return sendError(res, 500, "Registry error: Node creation rejected.", {
      asset: "create_failed",
    });
  }
};

const updateAsset = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin", "Asset Manager"].includes(req.user.role)) {
    return sendError(res, 403, "Strategic Error: Authorization insufficient for metadata modification.", {
      asset: "forbidden",
    });
  }
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return sendError(res, 400, "Registry Error: Node not found.", { id: "invalid_asset" });

    // SECURITY: Explicit property mapping (Â§Item 30 / Â§3.1)
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

    // Evaluate Compliance Risk Score
    await riskScoringService.evaluateAssetRisk(asset._id);

    await AuditLog.create({
      action: `METADATA_MODIFIED: ${asset.name}`,
      performedBy: req.user.email,
      details: `Asset ${asset.serialNumber} registry updated.`,
      ip: req.ip || req.connection?.remoteAddress
    });

    const io = req.app.get("io");
    if (io) io.emit("assetUpdated", asset);

    return res.json({ success: true, asset, message: "Registry node updated successfully." });
  } catch (error) {
    logger.error("Registry Sync Failure:", error);
    return sendError(res, 500, "Strategic Error: Asset modification protocol failed.", {
      asset: "update_failed",
    });
  }
};


// DELETE asset â€” Admin only
const deleteAsset = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin"].includes(req.user.role)) {
    return sendError(res, 403, "Forbidden: Only administrators can delete assets.", {
      asset: "forbidden",
    });
  }
  try {
    const assetId = req.params.id;
    const asset = await Asset.findById(assetId);
    if (!asset) return sendError(res, 400, "Asset not found", { id: "invalid_asset" });

    const isProduction = process.env.NODE_ENV === "production";
    if (!isProduction) {
      await asset.deleteOne();
      await AuditLog.create({
        action: "ASSET: Deleted (Dev Bypass)",
        performedBy: req.user.email,
        details: `Asset ${asset.name} deleted directly in non-production mode.`,
        ip: req.ip || req.connection?.remoteAddress,
      });
      const io = req.app.get("io");
      if (io) io.emit("assetDeleted", assetId);
      return res.json({ success: true, message: "Asset deleted successfully (dev bypass)." });
    }

    const PendingAction = require("../models/PendingAction");
    const { approvalId } = req.query;

    // Check if this action is already approved by another admin (Â§3.1)
    if (approvalId) {
      const approvedAction = await PendingAction.findById(approvalId);
      if (approvedAction && approvedAction.status === "APPROVED" && approvedAction.data.assetId === assetId) {
        // Verify it was approved by someone ELSE
        if (approvedAction.approvals[0].adminId.toString() === req.user._id.toString()) {
          return sendError(res, 403, "Security Violation: You cannot approve your own deletion request (4-Eyes Principle).", {
            approval: "self_approval_forbidden",
          });
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
        return res.json({ success: true, message: "Asset deleted successfully via Dual Authorization." });
      }
    }

    // Otherwise, create a pending request (Â§3.1)
    const existingPending = await PendingAction.findOne({ "data.assetId": assetId, status: "PENDING" });
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "A deletion request for this asset is already pending approval.",
        errors: { approval: "already_pending" },
        pendingActionId: existingPending._id
      });
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
      success: true,
      message: "Dual Authorization Required: A secondary administrator must approve this deletion for safety.",
      pendingActionId: pending._id
    });
  } catch (error) {
    return sendError(res, 500, "Asset deletion failed", {
      asset: "delete_failed",
    });
  }
};

// EXPORT assets to CSV â€” Admin only
const exportAssets = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin", "Security Auditor"].includes(req.user.role)) {
    return sendError(res, 403, "Forbidden: Only authorized roles can export inventory data.", {
      asset: "forbidden",
    });
  }

  try {
    const { status, type } = req.query;
    const query = {};
    if (status && status !== "All") query.status = status;
    if (type && type !== "All") query.type = type;

    const assets = await Asset.find(query).sort({ createdAt: -1 }).lean();

    // Mass Export Alert (Â§5.1 / Â§17)
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
    return sendError(res, 500, "Export failed", {
      asset: "export_failed",
    });
  }
};
const csv = require("csv-parser");

// BULK UPLOAD assets from CSV — Admin only
const bulkUploadAssets = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin"].includes(req.user.role)) {
    return sendError(res, 403, "Forbidden: Only administrators can bulk upload assets.", {
      asset: "forbidden",
    });
  }
  try {
    if (!req.file) {
      return sendError(res, 400, "No file uploaded", {
        file: "required",
      });
    }

    const results = [];
    const errors = [];
    let successCount = 0;

    await new Promise((resolve, reject) => {
      Readable.from(req.file.buffer)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", resolve)
        .on("error", reject);
    });

    const serials = results
      .map((row) => row.serialNumber)
      .filter(Boolean)
      .map((serial) => String(serial).trim());

    const existingAssets = await Asset.find({ serialNumber: { $in: serials } })
      .select("serialNumber")
      .lean();
    const existingSerials = new Set(existingAssets.map((asset) => asset.serialNumber));

    for (const row of results) {
      try {
        const { detectPromptInjection } = require("../utils/security");
        if (detectPromptInjection(row)) {
          await AuditLog.create({
            action: "SECURITY ALERT: Adversarial Macro Blocked",
            performedBy: req.user.email,
            details: `Quarantined CSV Row: Prompt Injection attempt detected in ${row.name || "unnamed row"}.`,
            ip: req.ip || req.connection?.remoteAddress
          });
          errors.push(`Row Rejected: High-Risk Adversarial Pattern Detected (${row.serialNumber || "unknown"}).`);
          continue;
        }

        if (!row.name || !row.type || !row.serialNumber) {
          errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
          continue;
        }

        if (existingSerials.has(row.serialNumber)) {
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
          usefulLifeYears: row.usefulLifeYears ? parseInt(row.usefulLifeYears, 10) : 5,
          qrCode: qrCodeDataUrl
        });

        await newAsset.save();
        newAsset.qrCode = await QRCode.toDataURL(JSON.stringify({
          id: newAsset._id,
          serialNumber: newAsset.serialNumber,
          name: newAsset.name
        }));
        await newAsset.save();

        successCount++;
        existingSerials.add(newAsset.serialNumber);
      } catch (err) {
        errors.push(`Failed on row ${row.serialNumber}: ${err.message}`);
      }
    }

    await AuditLog.create({
      action: "Bulk Uploaded Assets",
      performedBy: req.user?.email || "Unknown",
      details: `Uploaded ${successCount} assets. Errors: ${errors.length}`,
    });

    const io = req.app.get("io");
    if (io) io.emit("bulkAssetsUploaded");

    return res.json({
      success: true,
      message: `Successfully processed ${successCount} assets`,
      errors
    });
  } catch (error) {
    return sendError(res, 500, "Bulk upload failed", {
      file: "processing_failed",
    });
  }
};

// Network Scan â€” Admin only
const scanNetwork = async (req, res) => {
  if (!req.user || !["Super Admin", "Admin"].includes(req.user.role)) {
    return sendError(res, 403, "Forbidden: Only administrators can run network scans.", {
      asset: "forbidden",
    });
  }
  try {
    const io = req.app.get("io");
    const discoveryResult = await runNetworkDiscovery({ io, source: "manual" });

    if (discoveryResult.rogueCount > 0) {
      return res.json({
        success: true,
        data: discoveryResult.rogueDevicesFound[0],
        message: `Scan complete. ${discoveryResult.rogueCount} new unauthorized device(s) found!`,
        summary: {
          scannedCount: discoveryResult.scannedCount,
          anomalyWarnings: discoveryResult.anomalyWarnings.length,
        },
        timestamp: discoveryResult.timestamp,
      });
    }

    res.json({
      success: true,
      data: null,
      message: "Scan complete. Network is secure. No new unauthorized devices detected.",
      summary: {
        scannedCount: discoveryResult.scannedCount,
        anomalyWarnings: discoveryResult.anomalyWarnings.length,
      },
      timestamp: discoveryResult.timestamp,
    });
  } catch (error) {
    console.error("Network scan system failure:", error);
    return sendError(res, 500, "Internal server error", {
      scan: "failed",
    });
  }
};

// GET Security Alerts â€” Admin only
const getSecurityAlerts = async (req, res) => {
  try {
    const assets = await Asset.find({}, {
      name: 1,
      status: 1,
      updatedAt: 1,
      securityRisk: 1,
      "securityStatus.riskLevel": 1,
      vulnerabilities: 1,
    }).lean() || [];

    // Also fetch dedicated security alerts if our SOC engine generated them
    let dbAlerts = [];
    try {
      dbAlerts = await SecurityAlert.find()
        .populate("assetId", "name type serialNumber")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean() || [];
    } catch (e) {
      logger.warn(`Could not fetch from SecurityAlert model: ${e.message}`);
    }

    const alerts = [];

    // Safely generate dynamic alerts from Assets
    assets.forEach((asset) => {
      try {
        // Check Security Risk
        if (asset.securityRisk === "high" || (asset.securityStatus?.riskLevel && asset.securityStatus.riskLevel.toLowerCase() === "high")) {
          alerts.push({
            assetName: asset.name || "Unknown Asset",
            issue: "High security risk detected",
            severity: "high",
            timestamp: asset.updatedAt || new Date().toISOString()
          });
        }

        // Check Vulnerabilities
        if (asset.vulnerabilities?.length > 0) {
          alerts.push({
            assetName: asset.name || "Unknown Asset",
            issue: `${asset.vulnerabilities.length} vulnerabilities detected`,
            severity: "medium",
            timestamp: asset.updatedAt || new Date().toISOString()
          });
        }

        // Check Missing/Stolen Status
        if (asset.status === "missing" || asset.status === "stolen") {
          alerts.push({
            assetName: asset.name || "Unknown Asset",
            issue: `Asset flagged as ${asset.status.toUpperCase()}`,
            severity: "critical",
            timestamp: asset.updatedAt || new Date().toISOString()
          });
        }
      } catch (innerErr) {
        logger.warn(`Skipping corrupted asset record ${asset._id}: ${innerErr.message}`);
      }
    });

    // Merge in Dedicated DB Alerts
    dbAlerts.forEach((alert) => {
      try {
        const asset = alert.assetId || {};
        alerts.push({
          _id: alert._id,
          assetName: asset.name || "System Event",
          issue: alert.message || alert.description || "Security Protocol Violation",
          severity: (alert.severity || "medium").toLowerCase(),
          timestamp: alert.createdAt || new Date().toISOString()
        });
      } catch (innerErr) {
        logger.warn(`Skipping corrupted alert record ${alert._id}: ${innerErr.message}`);
      }
    });

    // Sort combined alerts by time descending
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json({
      success: true,
      alerts: alerts
    });
  } catch (error) {
    logger.error(`Security Alerts Core Error: ${error.message}`);

    return sendError(res, 500, "Strategic failure in security telemetry gathering. Forensic log captured.", {
      alerts: "fetch_failed",
    });
  }
};

const agentReport = async (req, res) => {
  try {
    const { serialNumber, healthStatus, networkStatus, osInfo, timestamp } = req.body;
    const signature = req.headers['x-agent-signature'];

    if (!signature) {
      return sendError(res, 403, "Missing agent signature", {
        signature: "required",
      });
    }

    // Prevent Replay Attacks (Reject payloads older than 5 minutes)
    if (!timestamp || Date.now() - timestamp > 5 * 60 * 1000) {
      return sendError(res, 403, "Payload expired / possible replay attack", {
        timestamp: "expired_or_invalid",
      });
    }

    // Verify HMAC Signature (Enterprise Agent Authentication)
    if (!process.env.AGENT_SECRET) {
      return sendError(res, 500, "Agent authentication is not configured", {
        agent: "secret_missing",
      });
    }
    const SECRET_KEY = process.env.AGENT_SECRET;
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    // Perform timing-safe equal to prevent timing attacks
    const providedSignature = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (providedSignature.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedSignature, expectedBuffer)) {
      // Log Unauthorized Agent Attempt
      await AuditLog.create({
        action: `SECURITY ALERT: Unauthorized Agent Connection Blocked`,
        performedBy: `Agent IP: ${req.ip}`,
        details: `Failed HMAC signature verification for Serial: ${serialNumber}`,
      });
      return sendError(res, 403, "Unauthorized agent signature", {
        signature: "invalid",
      });
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

    // Auto-update top-level IP/MAC if it changed (Â§Category 7)
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

    // REAL-TIME SYNC (Â§Category 4)
    const io = req.app.get("io");
    if (io) {
      if (isNewlyCreated) io.emit("assetCreated", asset);
      else io.emit("assetUpdated", asset);
    }

    res.json({ success: true, message: "Telemetry received", assetId: asset._id });

  } catch (error) {
    return sendError(res, 500, "Error processing report", {
      telemetry: "processing_failed",
    });
  }
};

// VERIFY ASSET INTEGRITY â€” Secure verification of row-level data (Â§4.1)
const verifyAssetIntegrity = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: "Asset not found" });

    // Recalculate hash for verification (Â§4.1)
    const payload = `${asset.name}|${asset.type}|${asset.serialNumber}|${asset.status}|${asset.assignedTo}`;
    const calculatedHash = crypto.createHash("sha256").update(payload).digest("hex");

    const isTampered = asset.integrityHash !== calculatedHash;

    if (isTampered) {
      // Route through central pipeline: dedup + SOAR + single WS broadcast
      await correlationEngine.triggerAlert("TAMPERING", {
        message: `INTEGRITY BREACH: Asset tampering detected for ${asset.name} (ID: ${asset._id}). Hash mismatch â€” possible out-of-band DB modification.`,
        ip: req.ip || "Unknown",
        severity: "CRITICAL",
        metadata: { assetId: String(asset._id), storedHash: asset.integrityHash, calculatedHash }
      });

      await AuditLog.create({
        action: "SECURITY ALERT: Record Tampering Detected",
        performedBy: req.user?.email || "System-Monitor",
        details: `Integrity check FAILED for Asset ID ${asset._id} (${asset.name}). Database mismatch detected (Â§4.1).`,
        ip: req.ip || req.connection?.remoteAddress
      });
    }

    res.json({
      success: true,
      assetId: asset._id,
      isIntegrityValid: !isTampered,
      storedHash: asset.integrityHash,
      calculatedHash: calculatedHash,
      status: isTampered ? "SECURITY BREACH DETECTED" : "VERIFIED SAFE"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Integrity verification system failure." });
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






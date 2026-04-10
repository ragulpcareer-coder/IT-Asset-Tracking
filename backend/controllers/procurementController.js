"use strict";

const ProcurementRequest = require("../models/ProcurementRequest");
const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");
const { authorizeRoles } = require("../middleware/rbacMiddleware");

const createRequest = async (req, res) => {
  try {
    const { assetType, quantity, justification, vendor } = req.body || {};
    if (!assetType) return res.status(400).json({ success: false, message: "Asset type is required" });

    const requesterName = req.user?.name || "User";
    const requesterEmail = req.user?.email || "unknown@example.com";

    const request = await ProcurementRequest.create({
      requesterName,
      requesterEmail,
      assetType,
      quantity: Number(quantity) || 1,
      justification: justification || "",
      vendor: vendor || ""
    });

    await AuditLog.create({
      action: "PROCUREMENT: Request Created",
      performedBy: requesterEmail,
      details: `Requested ${request.quantity} x ${assetType}.`,
      ip: req.ip || req.connection?.remoteAddress,
      resource: "ProcurementRequest",
      resourceId: request._id
    });

    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create request" });
  }
};

const listRequests = async (_req, res) => {
  try {
    const requests = await ProcurementRequest.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load requests" });
  }
};

const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendor, poNumber, expectedDelivery } = req.body || {};

    const request = await ProcurementRequest.findById(id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    request.status = "APPROVED";
    request.vendor = vendor || request.vendor;
    request.poNumber = poNumber || request.poNumber;
    request.expectedDelivery = expectedDelivery ? new Date(expectedDelivery) : request.expectedDelivery;
    request.approvedBy = req.user?.email || "admin";
    request.approvedAt = new Date();
    await request.save();

    await AuditLog.create({
      action: "PROCUREMENT: Request Approved",
      performedBy: req.user?.email || "admin",
      details: `Approved request ${request._id} for ${request.assetType}.`,
      ip: req.ip || req.connection?.remoteAddress,
      resource: "ProcurementRequest",
      resourceId: request._id
    });

    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: "Approval failed" });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ProcurementRequest.findById(id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    request.status = "REJECTED";
    await request.save();

    await AuditLog.create({
      action: "PROCUREMENT: Request Rejected",
      performedBy: req.user?.email || "admin",
      details: `Rejected request ${request._id} for ${request.assetType}.`,
      ip: req.ip || req.connection?.remoteAddress,
      resource: "ProcurementRequest",
      resourceId: request._id
    });

    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: "Rejection failed" });
  }
};

const receiveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { assets } = req.body || {};

    const request = await ProcurementRequest.findById(id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ success: false, message: "Assets list is required" });
    }

    const createdAssets = [];
    for (const item of assets) {
      if (!item.serialNumber) {
        return res.status(400).json({ success: false, message: "Serial number is required for each asset" });
      }

      const asset = await Asset.create({
        name: item.name || `${request.assetType} (${item.serialNumber})`,
        type: request.assetType,
        serialNumber: item.serialNumber,
        status: "available",
        assignedTo: item.assignedTo || null,
        purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : Date.now(),
        purchasePrice: Number(item.purchasePrice) || 0,
        salvageValue: Number(item.salvageValue) || 0,
        usefulLifeYears: Number(item.usefulLifeYears) || 3,
        ipAddress: item.ipAddress || "",
        macAddress: item.macAddress || "",
        location: item.location || undefined,
        securityStatus: { isAuthorized: true, riskLevel: "Low", remarks: "Received & tagged" }
      });

      createdAssets.push(asset);
    }

    request.status = "RECEIVED";
    request.receivedAt = new Date();
    request.assetIds = createdAssets.map((a) => a._id);
    await request.save();

    await AuditLog.create({
      action: "PROCUREMENT: Assets Received",
      performedBy: req.user?.email || "admin",
      details: `Received ${createdAssets.length} assets for request ${request._id}.`,
      ip: req.ip || req.connection?.remoteAddress,
      resource: "ProcurementRequest",
      resourceId: request._id
    });

    res.json({ success: true, request, assets: createdAssets });
  } catch (error) {
    res.status(500).json({ success: false, message: "Receiving failed" });
  }
};

module.exports = {
  createRequest,
  listRequests,
  approveRequest,
  rejectRequest,
  receiveRequest
};

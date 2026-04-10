"use strict";

const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");
const { sendWelcomeOnboardingEmail } = require("../utils/emailService");

const autoAssignOldestLaptop = async (req, res) => {
  try {
    const { name, email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const asset = await Asset.findOne({
      type: /laptop/i,
      status: "available"
    }).sort({ purchaseDate: 1 });

    if (!asset) {
      return res.status(404).json({ success: false, message: "No available laptops found" });
    }

    asset.assignedTo = email;
    asset.status = "assigned";
    await asset.save();

    await AuditLog.create({
      action: "ONBOARDING: Auto-Assigned Asset",
      performedBy: req.user?.email || "System",
      details: `Auto-assigned ${asset.name} (${asset.serialNumber}) to ${email}.`,
      ip: req.ip || req.connection?.remoteAddress
    });

    await sendWelcomeOnboardingEmail({ name, email, asset }).catch(() => {});

    res.json({
      success: true,
      asset,
      message: "Oldest available laptop assigned and welcome email sent."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Onboarding assignment failed" });
  }
};

module.exports = { autoAssignOldestLaptop };

const SoftwareLicense = require("../models/SoftwareLicense");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");

// @desc    Get all software licenses
// @route   GET /api/software
// @access  Private/Admin
const getSoftware = async (req, res) => {
    try {
        const licenses = await SoftwareLicense.find({}).populate("assignedUsers", "name email");
        res.json(licenses);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch software licenses" });
    }
};

// @desc    Create a software license
// @route   POST /api/software
// @access  Private/Admin
const createSoftware = async (req, res) => {
    try {
        const license = await SoftwareLicense.create(req.body);

        await AuditLog.create({
            action: "Software License Created",
            performedBy: req.user.email,
            details: `Created license for ${license.name} (${license.vendor})`,
            ip: req.ip || req.connection.remoteAddress,
        });

        res.status(201).json(license);
    } catch (error) {
        res.status(500).json({ message: "Failed to create license" });
    }
};

// @desc    Assign user to software seat
// @route   POST /api/software/:id/assign
// @access  Private/Admin
const assignUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const license = await SoftwareLicense.findById(req.params.id);
        if (!license) return res.status(404).json({ message: "License not found" });

        if (license.assignedUsers.includes(userId)) {
            return res.status(400).json({ message: "User already assigned to this software" });
        }

        if (license.assignedUsers.length >= license.totalSeats) {
            return res.status(400).json({ message: "No seats available for this license" });
        }

        license.assignedUsers.push(userId);
        await license.save();

        await AuditLog.create({
            action: "License Assigned",
            performedBy: req.user.email,
            details: `Assigned User ID: ${userId} to ${license.name}`,
            ip: req.ip || req.connection.remoteAddress,
        });

        const updatedLicense = await SoftwareLicense.findById(req.params.id).populate("assignedUsers", "name email");
        res.json(updatedLicense);
    } catch (error) {
        res.status(500).json({ message: "Failed to assign user" });
    }
};

module.exports = {
    getSoftware,
    createSoftware,
    assignUser
};

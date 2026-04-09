const SoftwareLicense = require("../models/SoftwareLicense");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { sendError, sendSuccess } = require("../utils/apiResponse");

const privilegedRoles = ["Super Admin", "Admin", "Manager", "Security Auditor"];

const getSoftware = async (req, res) => {
    try {
        const query = {};
        if (!privilegedRoles.includes(req.user.role)) {
            query.assignedUsers = req.user._id;
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

        const [licenses, total] = await Promise.all([
            SoftwareLicense.find(query)
                .populate("assignedUsers", "name email")
                .sort({ expiryDate: 1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            SoftwareLicense.countDocuments(query),
        ]);

        return sendSuccess(res, 200, "Software licenses fetched successfully", {
            count: licenses.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            licenses,
        });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch software licenses");
    }
};

const createSoftware = async (req, res) => {
    try {
        const license = await SoftwareLicense.create(req.body);

        await AuditLog.create({
            action: "Software License Created",
            performedBy: req.user.email,
            details: `Created license for ${license.name} (${license.vendor})`,
            ip: req.ip || req.connection.remoteAddress,
        });

        return sendSuccess(res, 201, "Software license created", { license });
    } catch (error) {
        return sendError(res, 500, "Failed to create license");
    }
};

const assignUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const [license, user] = await Promise.all([
            SoftwareLicense.findById(req.params.id),
            User.findById(userId).select("_id name email").lean(),
        ]);

        if (!license) return sendError(res, 404, "License not found", { id: "invalid_license" });
        if (!user) return sendError(res, 404, "User not found", { userId: "invalid_user" });

        if (license.assignedUsers.some((assigned) => assigned.toString() === userId)) {
            return sendError(res, 400, "User already assigned to this software", { userId: "already_assigned" });
        }

        if (license.assignedUsers.length >= license.totalSeats) {
            return sendError(res, 400, "No seats available for this license", { seats: "exhausted" });
        }

        license.assignedUsers.push(userId);
        await license.save();

        await AuditLog.create({
            action: "License Assigned",
            performedBy: req.user.email,
            details: `Assigned User ID: ${userId} to ${license.name}`,
            ip: req.ip || req.connection.remoteAddress,
        });

        const updatedLicense = await SoftwareLicense.findById(req.params.id).populate("assignedUsers", "name email").lean();
        return sendSuccess(res, 200, "User assigned successfully", { license: updatedLicense });
    } catch (error) {
        return sendError(res, 500, "Failed to assign user");
    }
};

module.exports = {
    getSoftware,
    createSoftware,
    assignUser
};

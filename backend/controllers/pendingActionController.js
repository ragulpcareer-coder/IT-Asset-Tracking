const PendingAction = require("../models/PendingAction");
const AuditLog = require("../models/AuditLog");

/**
 * PENDING ACTION CONTROLLER
 * Implements (§3.1) Dual Authorization / 4-Eyes Principle
 */

// List all pending actions for approval
exports.getPendingActions = async (req, res) => {
    try {
        const actions = await PendingAction.find({ status: "PENDING" })
            .populate("createdBy", "name email");
        res.json(actions);
    } catch (error) {
        res.status(500).json({ message: "Error fetching pending actions" });
    }
};

// Approve a pending action
exports.approveAction = async (req, res) => {
    try {
        const action = await PendingAction.findById(req.params.id);
        if (!action) return res.status(404).json({ message: "Pending action not found" });

        if (action.status !== "PENDING") {
            return res.status(400).json({ message: "Action is no longer pending." });
        }

        // 4-Eyes Principle Enforcement (§3.1): Approver cannot be the Creator
        if (action.createdBy.toString() === req.user._id.toString()) {
            return res.status(403).json({ message: "Security Violation: You cannot approve your own request (4-Eyes Principle)." });
        }

        action.approvals.push({
            adminId: req.user._id,
            approvedAt: new Date()
        });
        action.status = "APPROVED";
        await action.save();

        await AuditLog.create({
            action: "DUAL-AUTH: Action Approved",
            performedBy: req.user.email,
            details: `Admin approved ${action.actionType} requested by UserID: ${action.createdBy}`,
            ip: req.ip || req.connection?.remoteAddress
        });

        res.json({ message: "Action approved. The original requester can now execute the operation.", action });
    } catch (error) {
        res.status(500).json({ message: "Error approving action" });
    }
};

// Reject a pending action
exports.rejectAction = async (req, res) => {
    try {
        const action = await PendingAction.findById(req.params.id);
        if (!action) return res.status(404).json({ message: "Pending action not found" });

        action.status = "REJECTED";
        await action.save();

        await AuditLog.create({
            action: "DUAL-AUTH: Action Rejected",
            performedBy: req.user.email,
            details: `Admin rejected ${action.actionType} requested by UserID: ${action.createdBy}`,
            ip: req.ip || req.connection?.remoteAddress
        });

        res.json({ message: "Action rejected." });
    } catch (error) {
        res.status(500).json({ message: "Error rejecting action" });
    }
};

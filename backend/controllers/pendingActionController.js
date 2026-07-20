const PendingAction = require("../models/PendingAction");
const AuditLog = require("../models/AuditLog");
const { sendError, sendSuccess } = require("../utils/apiResponse");

exports.getPendingActions = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

        const [actions, total] = await Promise.all([
            PendingAction.find({ status: "PENDING" })
                .populate("createdBy", "name email")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            PendingAction.countDocuments({ status: "PENDING" }),
        ]);

        return sendSuccess(res, 200, "Pending actions fetched successfully", {
            count: actions.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            actions,
        });
    } catch (error) {
        return sendError(res, 500, "Error fetching pending actions");
    }
};

exports.approveAction = async (req, res) => {
    try {
        const action = await PendingAction.findById(req.params.id);
        if (!action) return sendError(res, 404, "Pending action not found", { id: "invalid_pending_action" });

        if (action.status !== "PENDING") {
            return sendError(res, 400, "Action is no longer pending.", { status: "not_pending" });
        }

        if (action.createdBy.toString() === req.user._id.toString()) {
            return sendError(res, 403, "Security violation: you cannot approve your own request (4-Eyes Principle).");
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

        return sendSuccess(res, 200, "Action approved. The original requester can now execute the operation.", { action });
    } catch (error) {
        return sendError(res, 500, "Error approving action");
    }
};

exports.rejectAction = async (req, res) => {
    try {
        const action = await PendingAction.findById(req.params.id);
        if (!action) return sendError(res, 404, "Pending action not found", { id: "invalid_pending_action" });

        action.status = "REJECTED";
        await action.save();

        await AuditLog.create({
            action: "DUAL-AUTH: Action Rejected",
            performedBy: req.user.email,
            details: `Admin rejected ${action.actionType} requested by UserID: ${action.createdBy}`,
            ip: req.ip || req.connection?.remoteAddress
        });

        return sendSuccess(res, 200, "Action rejected.");
    } catch (error) {
        return sendError(res, 500, "Error rejecting action");
    }
};

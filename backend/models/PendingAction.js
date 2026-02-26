const mongoose = require("mongoose");

const pendingActionSchema = new mongoose.Schema({
    actionType: {
        type: String,
        required: true,
        enum: ["DELETE_ASSET_DB", "MASS_USER_DELETE", "SYSTEM_CONFIG_CHANGE", "DELETE_ASSET"]
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    approvals: [{
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        approvedAt: { type: Date, default: Date.now }
    }],
    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED", "EXECUTED"],
        default: "PENDING"
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 60 * 60 * 1000) // 1 hour validity
    }
}, { timestamps: true });

module.exports = mongoose.model("PendingAction", pendingActionSchema);

const mongoose = require("mongoose");

/**
 * UserActivity Schema — IT Asset Tracking System
 * Provides forensic audit trail for user-specific actions.
 */
const userActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    actionType: {
        type: String,
        required: true,
        enum: [
            "PASSWORD_CHANGE",
            "PROFILE_UPDATE",
            "2FA_ENABLE",
            "2FA_DISABLE",
            "LOGIN",
            "LOGOUT",
            "PREFERENCE_UPDATE",
            "SECURITY_ALERT"
        ]
    },
    description: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String
    },
    deviceInfo: {
        type: mongoose.Schema.Types.Mixed
    },
    status: {
        type: String,
        enum: ["success", "failure", "warning"],
        default: "success"
    }
}, { timestamps: true });

// Index for fast retrieval of latest user activity
userActivitySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("UserActivity", userActivitySchema);

const mongoose = require("mongoose");

const UserSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    country: {
        type: String,
        default: "Unknown"
    },
    city: {
        type: String,
        default: "Unknown"
    },
    loginTime: {
        type: Date,
        default: Date.now,
        index: { expireAfterSeconds: 60 * 60 * 24 * 90 }
    }
}, { timestamps: true });

UserSessionSchema.index({ userId: 1, loginTime: -1 });
UserSessionSchema.index({ ipAddress: 1, loginTime: -1 });

module.exports = mongoose.model("UserSession", UserSessionSchema);

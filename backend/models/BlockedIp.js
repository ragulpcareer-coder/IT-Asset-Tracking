const mongoose = require("mongoose");

const blockedIpSchema = new mongoose.Schema({
    ipAddress: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    reason: {
        type: String,
        required: true,
        trim: true,
    },
    blockedAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        index: { expireAfterSeconds: 0 },
    }
});

blockedIpSchema.index({ blockedAt: -1 });

module.exports = mongoose.model("BlockedIp", blockedIpSchema);

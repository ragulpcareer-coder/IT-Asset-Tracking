const mongoose = require("mongoose");

const blockedIpSchema = new mongoose.Schema({
    ipAddress: {
        type: String,
        required: true,
        unique: true,
    },
    reason: {
        type: String,
        required: true,
    },
    blockedAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date, // Optional: if null, the block is permanent
    }
});

module.exports = mongoose.model("BlockedIp", blockedIpSchema);

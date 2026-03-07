const mongoose = require("mongoose");

const SecurityAlertSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            "BRUTE_FORCE",
            "SUSPICIOUS_IP",
            "UNUSUAL_LOGIN_TIME",
            "NEW_DEVICE_ADMIN",
            "ZERO_TRUST_VIOLATION",
            "AI_FLAGGED_ANOMALY"
        ]
    },
    severity: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default: "LOW"
    },
    status: {
        type: String,
        enum: ["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"],
        default: "OPEN"
    },
    description: String,
    sourceIp: String,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    assetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Asset"
    },
    incidentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Incident"
    },
    riskScoreImpact: {
        type: Number,
        default: 0
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    aiAnalysis: {
        explanation: String,
        recommendation: String,
        confidence: Number,
        analyzedAt: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for fast dashboard retrieval
SecurityAlertSchema.index({ severity: 1, status: 1 });
SecurityAlertSchema.index({ createdAt: -1 });

SecurityAlertSchema.post("save", function (doc) {
    if (global.io) {
        global.io.emit("security_alert", doc);
    }
});

module.exports = mongoose.model("SecurityAlert", SecurityAlertSchema);

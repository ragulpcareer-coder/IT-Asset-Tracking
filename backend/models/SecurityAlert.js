const mongoose = require("mongoose");

const SecurityAlertSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            // Auth / Login Threats
            "BRUTE_FORCE",
            "BRUTE_FORCE_ATTEMPT",
            "SUSPICIOUS_IP",
            "UNUSUAL_LOGIN_TIME",
            "NEW_DEVICE_ADMIN",
            "ZERO_TRUST_VIOLATION",
            "AI_FLAGGED_ANOMALY",
            // Network / Asset Threats
            "ROGUE_NODE",
            "NETWORK_ANOMALY",
            "TAMPERING",
            // Identity & Privilege
            "INSIDER_THREAT",
            "PRIVILEGE_ESCALATION",
            "DATA_EXFILTRATION",
            "UNAUTHORIZED_CMD",
            "LATERAL_MOVEMENT",
            "PERSISTENCE"
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
    // Canonical field names used by correlationEngine
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

// Fast retrieval indexes
SecurityAlertSchema.index({ severity: 1, status: 1 });
SecurityAlertSchema.index({ createdAt: -1 });
SecurityAlertSchema.index({ incidentId: 1 }); // Required for alert grouping performance
SecurityAlertSchema.index({ sourceIp: 1 }); // Critical for asset correlation
SecurityAlertSchema.index({ type: 1, userId: 1, sourceIp: 1, createdAt: -1 });

// NOTE: We deliberately do NOT emit WebSocket here.
// correlationEngine.triggerAlert() is the single source of truth for
// creating alerts + emitting WebSocket events (preventing double emissions).

module.exports = mongoose.model("SecurityAlert", SecurityAlertSchema);

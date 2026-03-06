const mongoose = require("mongoose");

const securityAlertSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ["BRUTE_FORCE", "ROGUE_NODE", "UNAUTHORIZED_CMD", "DATA_EXFILTRATION", "PRIVILEGE_ESCALATION", "LATERAL_MOVEMENT", "PERSISTENCE", "TAMPERING", "NETWORK_ANOMALY"]
    },
    severity: {
        type: String,
        required: true,
        enum: ["Low", "Medium", "High", "Critical"]
    },
    message: { type: String, required: true },
    details: { type: String },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    performedBy: { type: String },
    ip: { type: String },
    mitreTactic: { type: String },
    mitreTechnique: { type: String },
    status: { type: String, enum: ["New", "Investigating", "Resolved", "Dismissed"], default: "New" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SecurityAlert", securityAlertSchema);

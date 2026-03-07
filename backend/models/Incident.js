const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"],
            default: "OPEN",
        },
        severity: {
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            default: "MEDIUM",
        },
        description: {
            type: String,
        },
        sourceIp: {
            type: String,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        assetId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Asset",
        },
        alerts: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "SecurityAlert"
        }],
        timeline: [{
            timestamp: { type: Date, default: Date.now },
            event: { type: String, required: true },
            details: { type: String },
            performedBy: { type: String, default: "SYSTEM" }
        }],
        aiSummary: {
            type: String,
        },
        closedAt: {
            type: Date,
        }
    },
    {
        timestamps: true,
    }
);

// Auto-generate title if not provided
incidentSchema.pre("validate", function (next) {
    if (!this.title && this.alerts.length > 0) {
        this.title = `Incident: ${this.sourceIp || "Global Threat"} - ${new Date().toISOString()}`;
    }
    next();
});

module.exports = mongoose.model("Incident", incidentSchema);

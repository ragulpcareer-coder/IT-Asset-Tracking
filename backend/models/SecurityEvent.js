const mongoose = require("mongoose");

const SecurityEventSchema = new mongoose.Schema(
  {
    externalAlertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SecurityAlert",
      default: null
    },
    eventType: {
      type: String,
      required: true
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
    description: {
      type: String,
      default: ""
    },
    sourceIp: {
      type: String,
      default: "unknown"
    },
    ipType: {
      type: String,
      enum: ["PUBLIC", "PRIVATE", "UNKNOWN"],
      default: "UNKNOWN"
    },
    geoConfidence: {
      type: String,
      default: "low"
    },
    country: {
      type: String,
      default: "Unknown"
    },
    city: {
      type: String,
      default: "Unknown"
    },
    lat: {
      type: Number,
      default: 0
    },
    lon: {
      type: Number,
      default: 0
    },
    asn: {
      type: String,
      default: "Unknown"
    },
    isp: {
      type: String,
      default: "Unknown"
    },
    org: {
      type: String,
      default: "Unknown"
    },
    abuseScore: {
      type: Number,
      default: 0
    },
    intelConfidence: {
      type: String,
      default: "low"
    },
    sourceCountry: {
      type: String,
      default: "Unknown"
    },
    targetAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      default: null
    },
    targetIp: {
      type: String,
      default: ""
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
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
    occurredAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

SecurityEventSchema.index({ occurredAt: -1 });
SecurityEventSchema.index({ severity: 1, status: 1, occurredAt: -1 });
SecurityEventSchema.index({ eventType: 1, occurredAt: -1 });
SecurityEventSchema.index({ sourceIp: 1, occurredAt: -1 });
SecurityEventSchema.index({ targetAssetId: 1, occurredAt: -1 });
SecurityEventSchema.index({ externalAlertId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("SecurityEvent", SecurityEventSchema);


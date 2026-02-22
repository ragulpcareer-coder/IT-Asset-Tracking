const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    serialNumber: {
      type: String,
      unique: true,
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "assigned", "maintenance", "retired"],
      default: "available",
    },
    assignedTo: {
      type: String,
      default: null,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    purchasePrice: {
      type: Number,
      default: 0,
    },
    salvageValue: {
      type: Number,
      default: 0,
    },
    usefulLifeYears: {
      type: Number,
      default: 5,
    },
    warrantyExpiry: {
      type: Date,
    },
    qrCode: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    macAddress: {
      type: String,
    },
    location: {
      room: { type: String, default: 'Unknown' },
      department: { type: String, default: 'IT' },
      building: { type: String, default: 'Main HQ' }
    },
    networkStatus: {
      isOnline: { type: Boolean, default: false },
      lastSeen: { type: Date, default: Date.now }
    },
    healthStatus: {
      cpuUsage: { type: String, default: 'N/A' },
      ramTotal: { type: String, default: 'N/A' },
      ramUsed: { type: String, default: 'N/A' },
      ramUsagePercent: { type: String, default: 'N/A' },
      lastReported: { type: Date }
    },
    osInfo: {
      platform: { type: String, default: '' },
      release: { type: String, default: '' },
      hostname: { type: String, default: '' }
    },
    hardwareFingerprint: {
      uuid: { type: String, default: '' },
      biosSerial: { type: String, default: '' }
    },
    securityStatus: {
      isAuthorized: { type: Boolean, default: true },
      riskLevel: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Low' },
      remarks: { type: String, default: '' }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

module.exports = mongoose.model("Asset", assetSchema);

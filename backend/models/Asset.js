const mongoose = require("mongoose");
const crypto = require("crypto");
const mongooseFieldEncryption = require("mongoose-field-encryption").fieldEncryption;

const assetTypes = ["Laptop", "Desktop", "Server", "Network", "Mobile", "Printer", "IoT", "Software", "Other", "Computer"];
const assetStatuses = ["available", "assigned", "maintenance", "lost", "retired"];
const classifications = ["Public", "Internal", "Confidential", "Restricted"];

const assetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, required: true, enum: assetTypes, index: true },
    serialNumber: { type: String, unique: true, required: true, trim: true, index: true },
    uuid: {
      type: String,
      unique: true,
      default: () => require("crypto").randomUUID(),
      index: true,
    },
    classification: { type: String, enum: classifications, default: "Internal", index: true },
    status: { type: String, enum: assetStatuses, default: "available", index: true },
    assignedTo: { type: String, default: null, trim: true, index: true },
    purchaseDate: { type: Date, default: Date.now },
    purchasePrice: { type: Number, default: 0, min: 0 },
    salvageValue: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: function (value) {
          return value <= (this.purchasePrice || 0);
        },
        message: "Salvage value cannot exceed purchase price",
      },
    },
    usefulLifeYears: { type: Number, default: 5, min: 1, max: 15 },
    warrantyExpiry: { type: Date, index: true },
    qrCode: { type: String },
    ipAddress: { type: String, index: true },
    macAddress: { type: String, index: true },
    location: {
      room: { type: String, default: "Unknown", trim: true },
      department: { type: String, default: "IT", trim: true },
      building: { type: String, default: "Main HQ", trim: true }
    },
    networkStatus: {
      isOnline: { type: Boolean, default: false },
      lastSeen: { type: Date, default: Date.now }
    },
    healthStatus: {
      cpuUsage: { type: String, default: "N/A" },
      ramTotal: { type: String, default: "N/A" },
      ramUsed: { type: String, default: "N/A" },
      ramUsagePercent: { type: String, default: "N/A" },
      lastReported: { type: Date }
    },
    osInfo: {
      platform: { type: String, default: "" },
      release: { type: String, default: "" },
      hostname: { type: String, default: "" }
    },
    hardwareFingerprint: {
      uuid: { type: String, default: "" },
      biosSerial: { type: String, default: "" }
    },
    securityStatus: {
      isAuthorized: { type: Boolean, default: true, index: true },
      riskLevel: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Low", index: true },
      remarks: { type: String, default: "" }
    },
    riskScore: { type: Number, default: 0, min: 0, max: 100, index: true },
    activeAlertsScore: { type: Number, default: 0, min: 0 },
    integrityHash: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

assetSchema.virtual("bookValue").get(function () {
  if (!this.purchasePrice) return 0;
  if (!this.purchaseDate) return this.purchasePrice;

  const now = new Date();
  const purchaseDate = new Date(this.purchaseDate);
  const yearsOwned = (now - purchaseDate) / (1000 * 60 * 60 * 24 * 365.25);
  const totalDepreciableAmount = this.purchasePrice - (this.salvageValue || 0);
  const annualDepreciation = totalDepreciableAmount / (this.usefulLifeYears || 5);
  const currentDepreciation = Math.min(totalDepreciableAmount, annualDepreciation * yearsOwned);
  const currentBookValue = this.purchasePrice - currentDepreciation;

  return Math.max(this.salvageValue || 0, Math.round(currentBookValue * 100) / 100);
});

assetSchema.index({ "networkStatus.isOnline": 1, "networkStatus.lastSeen": -1 });
assetSchema.index({ "networkStatus.lastSeen": -1 });
assetSchema.index({ status: 1, assignedTo: 1 });
assetSchema.index({ classification: 1, status: 1, warrantyExpiry: 1 });
assetSchema.index({ "location.department": 1, status: 1 });
assetSchema.index({ createdAt: -1 });
assetSchema.index({ serialNumber: 1 }, { unique: true });
assetSchema.index({ type: 1, status: 1, createdAt: -1 });
assetSchema.index({ riskScore: -1, updatedAt: -1 });
assetSchema.index({ macAddress: 1, updatedAt: -1 });
assetSchema.index({ ipAddress: 1, updatedAt: -1 });

assetSchema.pre("save", function (next) {
  let score = 0;

  if (this.status === "lost") score += 40;
  else if (this.status === "maintenance") score += 10;
  else if (this.status === "retired") score += 5;

  if (!this.securityStatus?.isAuthorized) score += 30;

  const lastSeen = this.networkStatus?.lastSeen;
  if (lastSeen) {
    const daysSinceLastSeen = (Date.now() - new Date(lastSeen)) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSeen > 30) score += 20;
    else if (daysSinceLastSeen > 7) score += 10;
  }

  if (this.warrantyExpiry && new Date(this.warrantyExpiry) < new Date()) score += 10;
  if (this.classification === "Restricted") score += 15;
  else if (this.classification === "Confidential") score += 10;

  if (this.purchaseDate) {
    const yearsOld = (Date.now() - new Date(this.purchaseDate)) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsOld > 5) score += 10;
  }

  if (this.activeAlertsScore) score += this.activeAlertsScore;

  this.riskScore = Math.min(100, Math.max(0, score));

  if (!this.securityStatus) this.securityStatus = { isAuthorized: true, riskLevel: "Low", remarks: "" };
  if (this.riskScore <= 30) this.securityStatus.riskLevel = "Low";
  else if (this.riskScore <= 60) this.securityStatus.riskLevel = "Medium";
  else if (this.riskScore <= 80) this.securityStatus.riskLevel = "High";
  else this.securityStatus.riskLevel = "Critical";

  next();
});

assetSchema.pre("save", function (next) {
  const payload = `${this.name}|${this.type}|${this.serialNumber}|${this.status}|${this.assignedTo}`;
  this.integrityHash = crypto.createHash("sha256").update(payload).digest("hex");
  next();
});

assetSchema.post("init", function (doc) {
  doc._previousStatus = doc.status;
});

assetSchema.pre("save", function (next) {
  if (!this.isNew && this.isModified("status")) {
    if (this._previousStatus === "retired" && this.status === "assigned") {
      return next(new Error("Illegal Asset Lifecycle Transition: Retired assets cannot be reassigned."));
    }
    if (this._previousStatus === "lost" && this.status === "assigned") {
      return next(new Error("Illegal Asset Lifecycle Transition: Lost assets must be marked available before assignment."));
    }
  }
  next();
});

assetSchema.plugin(mongooseFieldEncryption, {
  fields: ["serialNumber", "assignedTo", "ipAddress", "macAddress"],
  secret: process.env.DB_ENCRYPTION_SECRET,
  saltGenerator: function (secret) {
    return require("crypto").createHash("sha256").update(secret).digest("hex").substring(0, 16);
  },
});

module.exports = mongoose.model("Asset", assetSchema);

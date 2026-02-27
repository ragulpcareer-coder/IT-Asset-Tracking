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
    uuid: {
      type: String,
      unique: true,
      default: () => require('crypto').randomUUID()
    },
    classification: {
      type: String,
      enum: ["Public", "Internal", "Confidential", "Restricted"],
      default: "Internal"
    },
    status: {
      type: String,
      enum: ["available", "assigned", "maintenance", "lost", "retired"],
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
    },
    integrityHash: { type: String }, // SHA-256 integrity check (§4.1)
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Straight-Line Depreciation Calculation (§6.3)
assetSchema.virtual('bookValue').get(function () {
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

// Dashboard Metric Indexes — speed up the GET /api/dashboard/metrics queries
assetSchema.index({ 'networkStatus.isOnline': 1, 'networkStatus.lastSeen': -1 }); // active assets
assetSchema.index({ 'networkStatus.lastSeen': -1 });                               // patch compliance
assetSchema.index({ 'securityStatus.isAuthorized': 1 });                           // encryption score
assetSchema.index({ status: 1 });                                                   // status filter

const crypto = require("crypto");

assetSchema.pre('save', function (next) {
  // Generate integrity hash of the critical record sections (§4.1)
  const payload = `${this.name}|${this.type}|${this.serialNumber}|${this.status}|${this.assignedTo}`;
  this.integrityHash = crypto.createHash("sha256").update(payload).digest("hex");
  next();
});

// Enterprise Asset Lifecycle Management (Policy §6.4)
assetSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    // If it's a new asset, any initial state is fine (usually available)
    if (this.isNew) return next();

    // Check transition rules
    const oldStatus = this._previousStatus; // We need to capture this or fetch it
    // For simplicity, we can fetch it if needed, but Mongoose doesn't store OLD value easily without a plugin
    // Alternatively, we use the controller, but a schema-level check is safer.
    // Let's implement a small hack to store previous status:
  }
  next();
});

// Capture status for transition validation
assetSchema.post('init', function (doc) {
  doc._previousStatus = doc.status;
});

assetSchema.pre('save', function (next) {
  if (!this.isNew && this.isModified('status')) {
    // Rule: Retired -> Assigned = BLOCKED
    if (this._previousStatus === 'retired' && this.status === 'assigned') {
      return next(new Error('Illegal Asset Lifecycle Transition: Retired assets cannot be reassigned.'));
    }
    // Rule: Lost -> Assigned = BLOCKED (must be found/verified first)
    if (this._previousStatus === 'lost' && this.status === 'assigned') {
      return next(new Error('Illegal Asset Lifecycle Transition: Lost assets must be marked available before assignment.'));
    }
  }
  next();
});

const mongooseFieldEncryption = require("mongoose-field-encryption").fieldEncryption;

// DB ENCRYPTION: Encrypt sensitive asset data at rest (§4.1)
assetSchema.plugin(mongooseFieldEncryption, {
  fields: ["serialNumber", "assignedTo", "ipAddress", "macAddress"],
  secret: process.env.JWT_SECRET || "fallback_asset_key_must_be_stable",
  saltGenerator: function (secret) {
    return "1234567890123456"; // stable 16 char salt
  },
});

module.exports = mongoose.model("Asset", assetSchema);

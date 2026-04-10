const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const mongooseFieldEncryption = require("mongoose-field-encryption").fieldEncryption;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["Super Admin", "Admin", "Asset Manager", "Security Auditor", "Manager", "Employee", "Guest"],
    default: "Employee"
  },
  department: { type: String, default: "General", trim: true, maxlength: 120 },
  phone: { type: String, default: "", trim: true, maxlength: 20 },
  location: { type: String, default: "Headquarters", trim: true, maxlength: 120 },
  devices: [{
    ip: { type: String },
    userAgent: { type: String },
    fingerprint: mongoose.Schema.Types.Mixed,
    lastLogin: { type: Date }
  }],
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  twoFactorBackupCodes: [{ type: String }],
  failedTwoFactorAttempts: { type: Number, default: 0 },
  twoFactorLockUntil: { type: Date },
  isEmailVerified: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  lastLogin: { type: Date },
  isActive: { type: Boolean, default: true },
  offboardedAt: { type: Date },
  offboardedBy: { type: String, default: "" },
  offboardReason: { type: String, default: "" },
  lastLoginIp: { type: String },
  lastLoginGeo: { type: mongoose.Schema.Types.Mixed },
  privilegeToken: { type: String },
  privilegeTokenExpires: { type: Date },
  tokenVersion: { type: Number, default: 0 },
  behavioralMetadata: {
    typicalLoginHours: { type: [Number], default: [] },
    commonIps: { type: [String], default: [] },
    trustedDevices: { type: [String], default: [] },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    threatLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "LOW" },
    lastSecurityAuditAt: { type: Date }
  },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    activityNotifications: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
    trackLocation: { type: Boolean, default: true },
    trackIP: { type: Boolean, default: true },
  },
  activityTimestamps: {
    passwordChangedAt: { type: Date },
    profileUpdatedAt: { type: Date },
    tfaEnabledAt: { type: Date },
    tfaDisabledAt: { type: Date },
    tfaRecoveryCodesRotatedAt: { type: Date },
    lastSettingsUpdateAt: { type: Date },
  },
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isApproved: 1 });
userSchema.index({ role: 1 });
userSchema.index({ "devices.ip": 1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ twoFactorEnabled: 1 });
userSchema.index({ twoFactorLockUntil: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1, isApproved: 1, role: 1, createdAt: -1 });
userSchema.index({ "behavioralMetadata.threatLevel": 1, "behavioralMetadata.riskScore": -1 });

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.plugin(mongooseFieldEncryption, {
  fields: ["twoFactorSecret", "twoFactorBackupCodes", "emailVerificationToken", "passwordResetToken"],
  secret: process.env.DB_ENCRYPTION_SECRET,
  saltGenerator: function (secret) {
    return require("crypto").createHash("sha256").update(secret).digest("hex").substring(0, 16);
  },
});

module.exports = mongoose.model("User", userSchema);

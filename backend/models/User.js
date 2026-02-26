const mongoose = require("mongoose");
const mongooseFieldEncryption = require("mongoose-field-encryption").fieldEncryption;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["Super Admin", "Admin", "Asset Manager", "Security Auditor", "Manager", "Employee", "Guest"],
    default: "Employee"
  },
  department: { type: String, default: "General" },
  phone: { type: String, default: "" },
  location: { type: String, default: "Headquarters" },

  devices: [{
    ip: String,
    userAgent: String,
    fingerprint: mongoose.Schema.Types.Mixed,
    lastLogin: Date

  }],
  isTwoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  twoFactorBackupCodes: [{ type: String }],
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
  lastLoginIp: { type: String },
  lastLoginGeo: { type: mongoose.Schema.Types.Mixed }, // { country, city, coordinates }
  privilegeToken: { type: String },
  privilegeTokenExpires: { type: Date },

  // ─── SETTINGS & PREFERENCES (§Category 10) ──────────────────────────
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    activityNotifications: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
    trackLocation: { type: Boolean, default: true },
    trackIP: { type: Boolean, default: true },
  },

  // ─── ACTIVITY TRACKING (§Category 4) ────────────────────────────────
  activityTimestamps: {
    passwordChangedAt: { type: Date },
    profileUpdatedAt: { type: Date },
    tfaEnabledAt: { type: Date },
    lastSettingsUpdateAt: { type: Date },
  },
}, { timestamps: true });


const bcrypt = require("bcryptjs");

// Secure Password Hashing (§1.1)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Secure Password Verification (§1.1)
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// DB ENCRYPTION FIX: Encrypt highly sensitive secrets at the database layer
userSchema.plugin(mongooseFieldEncryption, {
  fields: ["twoFactorSecret", "twoFactorBackupCodes", "emailVerificationToken", "passwordResetToken"],
  secret: process.env.DB_ENCRYPTION_SECRET || process.env.JWT_SECRET || "fallback_dev_encryption_secret_must_change_in_prod",
  saltGenerator: function (secret) {
    return require('crypto').createHash('sha256').update(secret).digest('hex').substring(0, 16);
  },
});

module.exports = mongoose.model("User", userSchema);
const mongoose = require("mongoose");
const mongooseFieldEncryption = require("mongoose-field-encryption").fieldEncryption;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["Admin", "User"],
    default: "User"
  },
  isTwoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  twoFactorBackupCodes: [{ type: String }],
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  lastLogin: { type: Date }
}, { timestamps: true });

// DB ENCRYPTION FIX: Encrypt highly sensitive secrets at the database layer
userSchema.plugin(mongooseFieldEncryption, {
  fields: ["twoFactorSecret", "twoFactorBackupCodes", "emailVerificationToken", "passwordResetToken"],
  secret: process.env.JWT_SECRET || "fallback_dev_encryption_secret_must_change_in_prod",
  saltGenerator: function (secret) {
    return "1234567890123456"; // Use 16 chars salt for AES-256-CBC
  },
});

module.exports = mongoose.model("User", userSchema);
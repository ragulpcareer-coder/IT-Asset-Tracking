const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
  lastLogin: { type: Date },
  lastLoginIp: { type: String },
  isActive: { type: Boolean, default: true },
  // Offboarding is a user-lifecycle/asset-reassignment workflow, not part
  // of the login system itself, so it's kept as-is.
  offboardedAt: { type: Date },
  offboardedBy: { type: String, default: "" },
  offboardReason: { type: String, default: "" },
  // Incremented on password change or "log out everywhere" so previously
  // issued tokens stop being accepted without needing a server-side
  // token blocklist.
  tokenVersion: { type: Number, default: 0 },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    activityNotifications: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
  },
}, { timestamps: true });

userSchema.index({ phone: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ createdAt: -1 });

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");

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
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  lastLogin: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
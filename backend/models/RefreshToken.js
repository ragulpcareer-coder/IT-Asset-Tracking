const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema({
  tokenId: { type: String, required: true, unique: true, index: true },
  family: { type: String, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  revoked: { type: Boolean, default: false, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  createdAt: { type: Date, default: Date.now }
});

refreshTokenSchema.index({ user: 1, family: 1 });
refreshTokenSchema.index({ tokenId: 1, family: 1, user: 1 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);

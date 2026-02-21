const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema({
  tokenId: { type: String, required: true, unique: true },
  family: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  revoked: { type: Boolean, default: false },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);

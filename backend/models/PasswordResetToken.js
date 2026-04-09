const mongoose = require("mongoose");

const passwordResetTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    tokenHash: {
        type: String,
        required: true,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
    },
    used: {
        type: Boolean,
        default: false,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

passwordResetTokenSchema.index({ tokenHash: 1, used: 1, expiresAt: 1 });

module.exports = mongoose.model("PasswordResetToken", passwordResetTokenSchema);

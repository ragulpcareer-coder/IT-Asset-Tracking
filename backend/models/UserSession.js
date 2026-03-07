const mongoose = require("mongoose");

const UserSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    country: {
        type: String,
        default: "Unknown"
    },
    city: {
        type: String,
        default: "Unknown"
    },
    loginTime: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Indexing for faster searching
UserSessionSchema.index({ userId: 1, loginTime: -1 });
UserSessionSchema.index({ ipAddress: 1 });

module.exports = mongoose.model("UserSession", UserSessionSchema);

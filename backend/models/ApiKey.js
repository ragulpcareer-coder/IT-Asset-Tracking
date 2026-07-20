const mongoose = require("mongoose");
const crypto = require("crypto");

const apiKeySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },
        key: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        lastUsed: {
            type: Date,
            index: true,
        },
        revoked: {
            type: Boolean,
            default: false,
            index: true,
        }
    },
    { timestamps: true }
);

apiKeySchema.index({ createdBy: 1, revoked: 1, createdAt: -1 });

module.exports = mongoose.model("ApiKey", apiKeySchema);

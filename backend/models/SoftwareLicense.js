const mongoose = require("mongoose");

const softwareLicenseSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        vendor: {
            type: String,
            required: true,
        },
        key: {
            type: String,
            required: true,
        },
        totalSeats: {
            type: Number,
            default: 1,
        },
        assignedUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            }
        ],
        purchaseDate: {
            type: Date,
            default: Date.now,
        },
        expiryDate: {
            type: Date,
            required: true,
        },
        costPerSeat: {
            type: Number,
            default: 0,
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("SoftwareLicense", softwareLicenseSchema);

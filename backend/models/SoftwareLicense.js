const mongoose = require("mongoose");

const softwareLicenseSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        vendor: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        key: {
            type: String,
            required: true,
            trim: true,
        },
        totalSeats: {
            type: Number,
            default: 1,
            min: 1,
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
            index: true,
        },
        costPerSeat: {
            type: Number,
            default: 0,
            min: 0,
        }
    },
    { timestamps: true }
);

softwareLicenseSchema.index({ vendor: 1, name: 1 });
softwareLicenseSchema.index({ assignedUsers: 1 });
softwareLicenseSchema.index({ expiryDate: 1, createdAt: -1 });
softwareLicenseSchema.pre("save", function (next) {
    if (this.assignedUsers.length > this.totalSeats) {
        return next(new Error("Assigned users cannot exceed available seats."));
    }
    next();
});

module.exports = mongoose.model("SoftwareLicense", softwareLicenseSchema);

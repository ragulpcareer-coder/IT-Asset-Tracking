const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
    {
        assetId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Asset",
            required: true,
            index: true,
        },
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000,
        },
        status: {
            type: String,
            enum: ["Open", "In Progress", "Resolved", "Closed"],
            default: "Open",
            index: true,
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Critical"],
            default: "Medium",
            index: true,
        },
        repairCost: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

ticketSchema.index({ reportedBy: 1, createdAt: -1 });
ticketSchema.index({ assetId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model("Ticket", ticketSchema);

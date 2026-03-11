const mongoose = require("mongoose");

const ProcurementRequestSchema = new mongoose.Schema(
  {
    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true },
    assetType: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    justification: { type: String, default: "" },
    vendor: { type: String, default: "" },
    poNumber: { type: String, default: "" },
    preTagId: { type: String, default: "" },
    expectedDelivery: { type: Date },
    status: {
      type: String,
      enum: ["REQUESTED", "APPROVED", "ORDERED", "RECEIVED", "REJECTED"],
      default: "REQUESTED"
    },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date },
    receivedAt: { type: Date },
    assetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Asset" }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProcurementRequest", ProcurementRequestSchema);

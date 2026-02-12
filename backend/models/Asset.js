const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    serialNumber: {
      type: String,
      unique: true,
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "assigned", "maintenance", "retired"],
      default: "available",
    },
    assignedTo: {
      type: String,
      default: null,
    },
    purchaseDate: {
      type: Date,
    },
    warrantyExpiry: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Asset", assetSchema);

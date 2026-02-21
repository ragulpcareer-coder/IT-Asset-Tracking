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
      default: Date.now,
    },
    purchasePrice: {
      type: Number,
      default: 0,
    },
    salvageValue: {
      type: Number,
      default: 0,
    },
    usefulLifeYears: {
      type: Number,
      default: 5,
    },
    warrantyExpiry: {
      type: Date,
    },
    qrCode: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

module.exports = mongoose.model("Asset", assetSchema);

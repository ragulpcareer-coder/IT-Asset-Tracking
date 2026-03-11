"use strict";

const express = require("express");
const router = express.Router();
const { getPublicAssetHealth } = require("../controllers/assetController");

// Public asset health card (QR landing)
router.get("/assets/:id/health", getPublicAssetHealth);

module.exports = router;

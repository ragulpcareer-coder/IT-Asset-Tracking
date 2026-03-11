"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { checkInAsset } = require("../controllers/assetController");

// Any authenticated user can check-in their asset for geofencing
router.post("/asset", protect, checkInAsset);

module.exports = router;

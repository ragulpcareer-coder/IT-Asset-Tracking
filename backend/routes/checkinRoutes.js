"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { checkInAsset } = require("../controllers/assetController");
const validate = require("../middleware/validateRequest");
const { assetCheckInSchema } = require("../validators/assetValidators");

// Any authenticated user can check-in their asset for geofencing
router.post("/asset", protect, validate(assetCheckInSchema), checkInAsset);

module.exports = router;

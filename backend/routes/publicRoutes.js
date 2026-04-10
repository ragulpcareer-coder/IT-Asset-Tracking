"use strict";

const express = require("express");
const router = express.Router();
const { getPublicAssetHealth } = require("../controllers/assetController");
const validate = require("../middleware/validateRequest");
const { publicAssetHealthParamsSchema } = require("../validators/assetValidators");

// Public asset health card (QR landing)
router.get("/assets/:id/health", validate(publicAssetHealthParamsSchema, "params"), getPublicAssetHealth);

module.exports = router;

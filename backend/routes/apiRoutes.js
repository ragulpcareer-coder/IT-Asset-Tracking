/**
 * API Key Routes — IT Asset Tracking System
 *
 * RBAC Policy: All API key management is Admin only + 2FA (enterprise security).
 */

"use strict";

const express = require("express");
const router = express.Router();
const { getKeys, createKey, revokeKey } = require("../controllers/apiController");
const { protect, admin } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");

router.get("/", protect, admin, requireAdmin2FA, getKeys);
router.post("/", protect, admin, requireAdmin2FA, createKey);
router.post("/:id/revoke", protect, admin, requireAdmin2FA, revokeKey);

module.exports = router;

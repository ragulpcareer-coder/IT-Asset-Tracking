/**
 * Software License Routes — IT Asset Tracking System
 *
 * RBAC Policy:
 *  - GET /       → Authenticated users (controller restricts Users to own assigned licenses)
 *  - POST /      → Admin only + 2FA
 *  - POST /:id/assign → Admin only + 2FA
 */

"use strict";

const express = require("express");
const router = express.Router();
const { getSoftware, createSoftware, assignUser } = require("../controllers/softwareController");
const { protect, admin } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");

// Users can only see licenses assigned to them (enforced in controller)
router.get("/", protect, getSoftware);

// Admin-only license management
router.post("/", protect, admin, requireAdmin2FA, createSoftware);
router.post("/:id/assign", protect, admin, requireAdmin2FA, assignUser);

module.exports = router;

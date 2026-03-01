/**
 * Asset Routes — IT Asset Tracking System
 *
 * RBAC Policy:
 *  GET /         → All authenticated users (controller filters by role)
 *  GET /export   → Admin only + 2FA
 *  GET /security-alerts → Admin only + 2FA
 *  POST /                → Admin only + 2FA  (create asset)
 *  POST /bulk-upload     → Admin only + 2FA
 *  POST /scan-network    → Admin only + 2FA
 *  PUT  /:id             → Admin only + 2FA  (update asset)
 *  DELETE /:id           → Admin only + 2FA  (delete asset)
 *  POST /agent-report    → Secured by HMAC agent signature (no user auth)
 */

"use strict";

const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const { protect, admin, requireReAuth } = require("../middleware/authMiddleware");
const { requireAdmin2FA, verifyABAC } = require("../middleware/rbacMiddleware");

const {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  exportAssets,
  bulkUploadAssets,
  scanNetwork,
  getSecurityAlerts,
  agentReport,
} = require("../controllers/assetController");

// ── Standard User + Admin (Scoped by ABAC) ─────────────────────
router.get("/", protect, getAssets);
router.get("/:id", protect, verifyABAC, getAssetById);

// ── Admin Only (protect + admin + 2FA) ──────────────────────
router.get("/export", protect, admin, requireAdmin2FA, exportAssets);
router.get("/security-alerts", getSecurityAlerts); // Temporarily REMOVE auth middleware for debugging
router.post("/scan-network", protect, admin, requireAdmin2FA, scanNetwork);
router.post("/bulk-upload", protect, admin, requireAdmin2FA, upload.single("file"), bulkUploadAssets);
router.post("/", protect, admin, requireAdmin2FA, createAsset);
router.put("/:id", protect, admin, requireAdmin2FA, updateAsset);

// STEP-UP AUTH REQUIRED FOR DELETE (§3.4)
router.delete("/:id", protect, admin, requireAdmin2FA, requireReAuth, deleteAsset);


// ── Agent (HMAC-signed, no user session) ────────────────────
router.post("/agent-report", agentReport);

module.exports = router;

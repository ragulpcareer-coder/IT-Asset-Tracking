/**
 * Asset Routes â€” IT Asset Tracking System
 *
 * RBAC Policy:
 *  GET /         â†’ All authenticated users (controller filters by role)
 *  GET /export   â†’ Admin only + 2FA
 *  GET /security-alerts â†’ Admin only + 2FA
 *  POST /                â†’ Admin only + 2FA  (create asset)
 *  POST /bulk-upload     â†’ Admin only + 2FA
 *  POST /scan-network    â†’ Admin only + 2FA
 *  PUT  /:id             â†’ Admin only + 2FA  (update asset)
 *  DELETE /:id           â†’ Admin only + 2FA  (delete asset)
 *  POST /agent-report    â†’ Secured by HMAC agent signature (no user auth)
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
  bulkUpdateAssets,
  scanNetwork,
  getSecurityAlerts,
  agentReport,
} = require("../controllers/assetController");

// â”€â”€ Standard User + Admin (Scoped by ABAC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/", protect, getAssets);

// â”€â”€ Admin Only (protect + admin + 2FA / admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/export", protect, admin, requireAdmin2FA, exportAssets);
router.get("/security-alerts", protect, admin, getSecurityAlerts);
router.put("/bulk-update", protect, admin, requireAdmin2FA, bulkUpdateAssets);

// Dynamic Parameter Routes (MUST BE LAST to prevent intercepting static paths)
router.get("/:id", protect, verifyABAC, getAssetById);

router.post("/scan-network", protect, admin, requireAdmin2FA, scanNetwork);
router.post("/bulk-upload", protect, admin, requireAdmin2FA, upload.single("file"), bulkUploadAssets);
router.post("/", protect, admin, requireAdmin2FA, createAsset);
router.put("/:id", protect, admin, requireAdmin2FA, updateAsset);

// STEP-UP AUTH REQUIRED FOR DELETE (Â§3.4)
router.delete("/:id", protect, admin, requireAdmin2FA, deleteAsset);


// â”€â”€ Agent (HMAC-signed, no user session) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post("/agent-report", agentReport);

module.exports = router;

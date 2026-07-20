/**
 * Asset Routes — IT Asset Tracking System
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
const validate = require("../middleware/validateRequest");
const {
  assetBodySchema,
  assetUpdateSchema,
  assetIdParamsSchema,
  exportQuerySchema,
  assetListQuerySchema,
  agentReportSchema,
  bulkAssetUpdateSchema,
} = require("../validators/assetValidators");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = ["text/csv", "application/vnd.ms-excel", "text/plain"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only CSV files are allowed"));
    }
    cb(null, true);
  }
});
const uploadSingleCsv = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Invalid upload",
        errors: { file: "invalid_upload" },
      });
    }
    next();
  });
};

const { protect, admin } = require("../middleware/authMiddleware");
const { verifyABAC } = require("../middleware/rbacMiddleware");

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
router.get("/", protect, validate(assetListQuerySchema, "query"), getAssets);

// â”€â”€ Admin Only (protect + admin + 2FA / admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/export", protect, admin, validate(exportQuerySchema, "query"), exportAssets);
router.get("/security-alerts", protect, admin, getSecurityAlerts);
router.put("/bulk-update", protect, admin, validate(bulkAssetUpdateSchema), bulkUpdateAssets);

// Dynamic Parameter Routes (MUST BE LAST to prevent intercepting static paths)
router.get("/:id", protect, validate(assetIdParamsSchema, "params"), verifyABAC, getAssetById);

router.post("/scan-network", protect, admin, scanNetwork);
router.post("/bulk-upload", protect, admin, uploadSingleCsv, bulkUploadAssets);
router.post("/", protect, admin, validate(assetBodySchema), createAsset);
router.put("/:id", protect, admin, validate(assetIdParamsSchema, "params"), validate(assetUpdateSchema), updateAsset);

// STEP-UP AUTH REQUIRED FOR DELETE (§3.4)
router.delete("/:id", protect, admin, validate(assetIdParamsSchema, "params"), deleteAsset);


// â”€â”€ Agent (HMAC-signed, no user session) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post("/agent-report", validate(agentReportSchema), agentReport);

module.exports = router;

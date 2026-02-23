const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  exportAssets,
  bulkUploadAssets,
  scanNetwork,
  getSecurityAlerts,
  agentReport,
} = require("../controllers/assetController");

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// GET all (Filtered by user/role in controller)
router.get("/", protect, getAssets);

// EXPORT
router.get("/export", protect, authorizeRoles("Admin"), exportAssets);

// GET Security Alerts
router.get("/security-alerts", protect, authorizeRoles("Admin"), getSecurityAlerts);

// SCAN Network
router.post("/scan-network", protect, authorizeRoles("Admin"), scanNetwork);

// BULK UPLOAD
router.post("/bulk-upload", protect, authorizeRoles("Admin"), upload.single("file"), bulkUploadAssets);

// CREATE
router.post("/", protect, authorizeRoles("Admin"), createAsset);

// UPDATE
router.put("/:id", protect, authorizeRoles("Admin"), updateAsset);

// DELETE
router.delete("/:id", protect, authorizeRoles("Admin"), deleteAsset);

// AGENT REPORT (Open endpoint, but secured by secret in body)
router.post("/agent-report", agentReport);

module.exports = router;


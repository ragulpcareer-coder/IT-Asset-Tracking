const express = require("express");
const router = express.Router();
const { rotateSystemSecrets, getSecurityStatus, triggerManualBackup, downloadBackup } = require("../controllers/maintenanceController");
const { scanNetwork } = require("../controllers/assetController");
const { protect, admin } = require("../middleware/authMiddleware");
const validate = require("../middleware/validateRequest");
const { filenameParamsSchema } = require("../validators/routeValidators");

// Maintenance operations require:
// 1. Super Admin Level (protect + admin)
router.post("/rotate-keys", protect, admin, rotateSystemSecrets);
router.get("/status", protect, admin, getSecurityStatus);

// Manual Backup Management (§19)
router.post("/backup", protect, admin, triggerManualBackup);
router.get("/backup/download/:filename", protect, admin, validate(filenameParamsSchema, "params"), downloadBackup);

// Backward-compatible alias used by SOC page.
router.post("/scan-network", protect, admin, scanNetwork);

module.exports = router;

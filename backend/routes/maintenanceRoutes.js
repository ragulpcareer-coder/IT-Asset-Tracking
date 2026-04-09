const express = require("express");
const router = express.Router();
const { rotateSystemSecrets, getSecurityStatus, triggerManualBackup, downloadBackup } = require("../controllers/maintenanceController");
const { scanNetwork } = require("../controllers/assetController");
const { protect, admin, requireReAuth } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");
const validate = require("../middleware/validateRequest");
const { filenameParamsSchema } = require("../validators/routeValidators");

// Maintenance operations require:
// 1. Super Admin Level (protect + admin)
// 2. 2FA (requireAdmin2FA)
// 3. Step-up Auth (requireReAuth) (§3.4)
router.post("/rotate-keys", protect, admin, requireAdmin2FA, requireReAuth, rotateSystemSecrets);
router.get("/status", protect, admin, requireAdmin2FA, getSecurityStatus);

// Manual Backup Management (§19)
router.post("/backup", protect, admin, requireAdmin2FA, triggerManualBackup);
router.get("/backup/download/:filename", protect, admin, requireAdmin2FA, validate(filenameParamsSchema, "params"), requireReAuth, downloadBackup);

// Backward-compatible alias used by SOC page.
router.post("/scan-network", protect, admin, requireAdmin2FA, scanNetwork);

module.exports = router;

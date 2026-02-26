const express = require("express");
const router = express.Router();
const { rotateSystemSecrets, getSecurityStatus } = require("../controllers/maintenanceController");
const { protect, admin, requireReAuth } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");

// Maintenance operations require:
// 1. Super Admin Level (protect + admin)
// 2. 2FA (requireAdmin2FA)
// 3. Step-up Auth (requireReAuth) (§3.4)
router.post("/rotate-keys", protect, admin, requireAdmin2FA, requireReAuth, rotateSystemSecrets);
router.get("/status", protect, admin, requireAdmin2FA, getSecurityStatus);

module.exports = router;

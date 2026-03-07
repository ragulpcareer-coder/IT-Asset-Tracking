const express = require("express");
const router = express.Router();
const { analyzeAlert, getSecurityAlerts } = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");

// All SOC features require Admin or Auditor privileges
router.use(protect);
router.use(authorizeRoles("Super Admin", "Admin", "Security Auditor"));

router.get("/alerts", getSecurityAlerts);
router.post("/alerts/:alertId/analyze", analyzeAlert);

module.exports = router;

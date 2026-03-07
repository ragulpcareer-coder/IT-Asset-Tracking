const express = require("express");
const router = express.Router();
const { analyzeAlert, getSecurityAlerts } = require("../controllers/aiController");
const {
    simulateBruteForce,
    simulateInsiderThreat,
    simulateZeroTrustViolation,
    simulateExploitPattern
} = require("../controllers/socController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");

// All SOC features require Admin or Auditor privileges
router.use(protect);
router.use(authorizeRoles("Super Admin", "Admin", "Security Auditor"));

router.get("/alerts", getSecurityAlerts);
router.post("/alerts/:alertId/analyze", analyzeAlert);

// Elite: Incident Management & Stats
const { getIncidents, getIncidentById, getSocStats } = require("../controllers/socController");
router.get("/incidents", getIncidents);
router.get("/incidents/:id", getIncidentById);
router.get("/stats", getSocStats);

// Attack Simulations
router.post("/simulate/brute-force", simulateBruteForce);
router.post("/simulate/insider", simulateInsiderThreat);
router.post("/simulate/zero-trust", simulateZeroTrustViolation);
router.post("/simulate/exploit", simulateExploitPattern);

module.exports = router;

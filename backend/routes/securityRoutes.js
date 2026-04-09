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
const validate = require("../middleware/validateRequest");
const {
    alertIdParamsSchema,
    idParamsSchema,
    paginationQuerySchema,
    simulationBruteForceSchema,
    simulationUserSchema,
} = require("../validators/routeValidators");

// All SOC features require Admin or Auditor privileges
router.use(protect);
router.use(authorizeRoles("Super Admin", "Admin", "Security Auditor"));

router.get("/alerts", validate(paginationQuerySchema, "query"), getSecurityAlerts);
router.post("/alerts/:alertId/analyze", validate(alertIdParamsSchema, "params"), analyzeAlert);

// Elite: Incident Management & Stats
const { getIncidents, getIncidentById, getSocStats, getThreatMapPoints } = require("../controllers/socController");
router.get("/incidents", validate(paginationQuerySchema, "query"), getIncidents);
router.get("/incidents/:id", validate(idParamsSchema, "params"), getIncidentById);
router.get("/stats", getSocStats);
router.get("/threat-map", getThreatMapPoints);

// Attack Simulations
router.post("/simulate/brute-force", validate(simulationBruteForceSchema), simulateBruteForce);
router.post("/simulate/insider", validate(simulationUserSchema), simulateInsiderThreat);
router.post("/simulate/zero-trust", validate(simulationUserSchema), simulateZeroTrustViolation);
router.post("/simulate/exploit", validate(simulationUserSchema), simulateExploitPattern);

module.exports = router;

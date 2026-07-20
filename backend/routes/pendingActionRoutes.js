const express = require("express");
const router = express.Router();
const {
    getPendingActions,
    approveAction,
    rejectAction
} = require("../controllers/pendingActionController");
const { protect, admin } = require("../middleware/authMiddleware");
const validate = require("../middleware/validateRequest");
const { idParamsSchema, paginationQuerySchema } = require("../validators/routeValidators");

// All Dual-Auth endpoints require Super Admin, Admin, or Auditor (?) but let's stick to Admin 
// Admin role is mandated for approval of others actions 
router.get("/", protect, admin, validate(paginationQuerySchema, "query"), getPendingActions);
router.put("/:id/approve", protect, admin, validate(idParamsSchema, "params"), approveAction);
router.put("/:id/reject", protect, admin, validate(idParamsSchema, "params"), rejectAction);

module.exports = router;

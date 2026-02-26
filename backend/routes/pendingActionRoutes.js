const express = require("express");
const router = express.Router();
const {
    getPendingActions,
    approveAction,
    rejectAction
} = require("../controllers/pendingActionController");
const { protect, admin } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");

// All Dual-Auth endpoints require Super Admin, Admin, or Auditor (?) but let's stick to Admin 
// Admin role is mandated for approval of others actions 
router.get("/", protect, admin, requireAdmin2FA, getPendingActions);
router.put("/:id/approve", protect, admin, requireAdmin2FA, approveAction);
router.put("/:id/reject", protect, admin, requireAdmin2FA, rejectAction);

module.exports = router;

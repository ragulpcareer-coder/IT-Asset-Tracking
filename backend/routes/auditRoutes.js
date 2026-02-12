const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// Only Admin can see logs
router.get("/", protect, authorizeRoles("Admin"), async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 });
  res.json(logs);
});

module.exports = router;

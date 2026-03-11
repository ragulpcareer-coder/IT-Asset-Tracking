"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const {
  createRequest,
  listRequests,
  approveRequest,
  rejectRequest,
  receiveRequest
} = require("../controllers/procurementController");

router.use(protect);

// All authenticated users can create requests
router.post("/requests", createRequest);

// Admin/Managers can view and process
router.get("/requests", authorizeRoles("Super Admin", "Admin", "Asset Manager", "Manager"), listRequests);
router.put("/requests/:id/approve", authorizeRoles("Super Admin", "Admin", "Asset Manager"), approveRequest);
router.put("/requests/:id/reject", authorizeRoles("Super Admin", "Admin", "Asset Manager"), rejectRequest);
router.post("/requests/:id/receive", authorizeRoles("Super Admin", "Admin", "Asset Manager"), receiveRequest);

module.exports = router;

"use strict";

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const validate = require("../middleware/validateRequest");
const {
  createRequest,
  listRequests,
  approveRequest,
  rejectRequest,
  receiveRequest
} = require("../controllers/procurementController");
const {
  paginationQuerySchema,
  idParamsSchema,
  procurementCreateSchema,
  procurementDecisionSchema,
  procurementReceiveSchema,
} = require("../validators/routeValidators");

router.use(protect);

// All authenticated users can create requests
router.post("/requests", validate(procurementCreateSchema), createRequest);

// Admin/Managers can view and process
router.get("/requests", authorizeRoles("Super Admin", "Admin", "Asset Manager", "Manager"), validate(paginationQuerySchema, "query"), listRequests);
router.put("/requests/:id/approve", authorizeRoles("Super Admin", "Admin", "Asset Manager"), validate(idParamsSchema, "params"), validate(procurementDecisionSchema), approveRequest);
router.put("/requests/:id/reject", authorizeRoles("Super Admin", "Admin", "Asset Manager"), validate(idParamsSchema, "params"), rejectRequest);
router.post("/requests/:id/receive", authorizeRoles("Super Admin", "Admin", "Asset Manager"), validate(idParamsSchema, "params"), validate(procurementReceiveSchema), receiveRequest);

module.exports = router;

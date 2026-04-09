/**
 * API Key Routes — IT Asset Tracking System
 *
 * RBAC Policy: All API key management is Admin only + 2FA (enterprise security).
 */

"use strict";

const express = require("express");
const router = express.Router();
const { getKeys, createKey, revokeKey } = require("../controllers/apiController");
const { protect, admin } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");
const validate = require("../middleware/validateRequest");
const {
  paginationQuerySchema,
  apiKeyCreateSchema,
  idParamsSchema,
} = require("../validators/routeValidators");

router.get("/", protect, admin, requireAdmin2FA, validate(paginationQuerySchema, "query"), getKeys);
router.post("/", protect, admin, requireAdmin2FA, validate(apiKeyCreateSchema), createKey);
router.post("/:id/revoke", protect, admin, requireAdmin2FA, validate(idParamsSchema, "params"), revokeKey);

module.exports = router;

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
const validate = require("../middleware/validateRequest");
const {
  paginationQuerySchema,
  apiKeyCreateSchema,
  idParamsSchema,
} = require("../validators/routeValidators");

router.get("/", protect, admin, validate(paginationQuerySchema, "query"), getKeys);
router.post("/", protect, admin, validate(apiKeyCreateSchema), createKey);
router.post("/:id/revoke", protect, admin, validate(idParamsSchema, "params"), revokeKey);

module.exports = router;

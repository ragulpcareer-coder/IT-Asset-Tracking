/**
 * Ticket Routes — IT Asset Tracking System
 *
 * RBAC Policy:
 *  - GET  /    → All authenticated users (controller scopes by role)
 *  - POST /    → All authenticated users (any user can submit a ticket)
 *  - PUT  /:id → Admin only + 2FA required (resolve/update)
 */

"use strict";

const express = require("express");
const router = express.Router();
const { getTickets, createTicket, updateTicket } = require("../controllers/ticketController");
const { protect, admin } = require("../middleware/authMiddleware");
const validate = require("../middleware/validateRequest");
const {
  paginationQuerySchema,
  ticketCreateSchema,
  ticketUpdateSchema,
  idParamsSchema,
} = require("../validators/routeValidators");

// Any authenticated user can view and submit tickets
router.get("/", protect, validate(paginationQuerySchema, "query"), getTickets);
router.post("/", protect, validate(ticketCreateSchema), createTicket);

// Only Admin (with 2FA enforced) can update/resolve tickets
router.put("/:id", protect, admin, validate(idParamsSchema, "params"), validate(ticketUpdateSchema), updateTicket);

module.exports = router;

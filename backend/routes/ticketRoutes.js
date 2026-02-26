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
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");

// Any authenticated user can view and submit tickets
router.get("/", protect, getTickets);
router.post("/", protect, createTicket);

// Only Admin (with 2FA enforced) can update/resolve tickets
router.put("/:id", protect, admin, requireAdmin2FA, updateTicket);

module.exports = router;

const express = require("express");
const router = express.Router();
const {
    getTickets,
    createTicket,
    updateTicket,
} = require("../controllers/ticketController");
const { protect, admin } = require("../middleware/authMiddleware");

// Admin AND normal user
router.get("/", protect, getTickets);
// Any user can report a ticket
router.post("/", protect, createTicket);
// Admin can update/resolve a ticket
router.put("/:id", protect, admin, updateTicket);

module.exports = router;

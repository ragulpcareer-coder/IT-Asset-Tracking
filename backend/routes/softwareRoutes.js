const express = require("express");
const router = express.Router();
const {
    getSoftware,
    createSoftware,
    assignUser
} = require("../controllers/softwareController");
const { protect, admin } = require("../middleware/authMiddleware");

// Admins only manage software licenses
// Admins manage licenses, but users can view their own
router.get("/", protect, getSoftware);
router.post("/", protect, admin, createSoftware);
router.post("/:id/assign", protect, admin, assignUser);

module.exports = router;

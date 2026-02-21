const express = require("express");
const router = express.Router();
const {
    getSoftware,
    createSoftware,
    assignUser
} = require("../controllers/softwareController");
const { protect, admin } = require("../middleware/authMiddleware");

// Admins only manage software licenses
router.get("/", protect, admin, getSoftware);
router.post("/", protect, admin, createSoftware);
router.post("/:id/assign", protect, admin, assignUser);

module.exports = router;

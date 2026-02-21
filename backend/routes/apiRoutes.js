const express = require("express");
const router = express.Router();
const {
    getKeys,
    createKey,
    revokeKey
} = require("../controllers/apiController");
const { protect, admin } = require("../middleware/authMiddleware");

router.get("/", protect, admin, getKeys);
router.post("/", protect, admin, createKey);
router.post("/:id/revoke", protect, admin, revokeKey);

module.exports = router;

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
} = require("../controllers/assetController");

// GET all
router.get("/", getAssets);

// CREATE
router.post("/", protect, authorizeRoles("Admin"), createAsset);

// UPDATE
router.put("/:id", protect, authorizeRoles("Admin"), updateAsset);

// DELETE
router.delete("/:id", protect, authorizeRoles("Admin"), deleteAsset);

module.exports = router;


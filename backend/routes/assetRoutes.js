const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  exportAssets,
  bulkUploadAssets,
} = require("../controllers/assetController");

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// GET all
router.get("/", getAssets);

// EXPORT
router.get("/export", protect, authorizeRoles("Admin"), exportAssets);

// BULK UPLOAD
router.post("/bulk-upload", protect, authorizeRoles("Admin"), upload.single("file"), bulkUploadAssets);

// CREATE
router.post("/", protect, authorizeRoles("Admin"), createAsset);

// UPDATE
router.put("/:id", protect, authorizeRoles("Admin"), updateAsset);

// DELETE
router.delete("/:id", protect, authorizeRoles("Admin"), deleteAsset);

module.exports = router;


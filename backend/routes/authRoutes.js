const express = require("express");
const router = express.Router();
const { register, login, getMe, changePassword, updateProfile, logoutAll } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/change-password", protect, changePassword);
router.put("/profile", protect, updateProfile);
router.post("/logout-all", protect, logoutAll);

module.exports = router;
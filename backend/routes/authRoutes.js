const express = require("express");
const router = express.Router();
const {
    register, login, getMe, changePassword, updateProfile,
    logoutAll, refresh, generate2FA, verify2FA, disable2FA,
    getAllUsers, promoteUser, deleteUser
} = require("../controllers/authController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", protect, getMe);
router.post("/change-password", protect, changePassword);
router.put("/profile", protect, updateProfile);
router.post("/logout-all", protect, logoutAll);

// Advanced 2FA Routes
router.post("/2fa/generate", protect, generate2FA);
router.post("/2fa/verify", protect, verify2FA);
router.post("/2fa/disable", protect, disable2FA);

// Admin Routes (Zero Trust Architecture)
router.get("/users", protect, admin, getAllUsers);
router.put("/users/:id/promote", protect, admin, promoteUser);
router.delete("/users/:id", protect, admin, deleteUser);

module.exports = router;
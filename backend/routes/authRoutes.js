const express = require("express");
const router = express.Router();
const {
    register, login, logout, getMe, changePassword, updateProfile,
    logoutAll, refresh, generate2FA, verify2FA, disable2FA,
    getAllUsers, promoteUser, demoteUser, suspendUser, adminResetPassword, adminDisable2FA, deleteUser,
    approveUser, rejectUser, diagEmailTest
} = require("../controllers/authController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);
router.post("/refresh", refresh);
router.get("/me", protect, getMe);
router.get("/approve/:id", approveUser);
router.get("/reject/:id", rejectUser);
router.get("/diag/email-test", diagEmailTest);
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
router.put("/users/:id/demote", protect, admin, demoteUser);
router.put("/users/:id/suspend", protect, admin, suspendUser);
router.put("/users/:id/reset-password", protect, admin, adminResetPassword);
router.put("/users/:id/disable-2fa", protect, admin, adminDisable2FA);
router.delete("/users/:id", protect, admin, deleteUser);

module.exports = router;
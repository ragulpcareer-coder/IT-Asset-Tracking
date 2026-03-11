/**
 * Auth Routes â€” IT Asset Tracking System
 *
 * RBAC Policy:
 *  - Admin routes: require protect + admin + requireAdmin2FA
 *  - User routes:  require protect only
 *  - Public:       register, login, approve/reject links, token refresh
 */

"use strict";

const express = require("express");
const router = express.Router();

const {
    register, login, verify2FALogin, logout, getMe, changePassword, updateProfile,
    logoutAll, refresh, generate2FA, verify2FA, disable2FA,
    getAllUsers, promoteUser, demoteUser, suspendUser,
    adminResetPassword, adminDisable2FA, deleteUser,
    approveUser, rejectUser, approveUserByAdmin, diagEmailTest, getUserActivity,
    offboardUser,
    forgotPassword, validateResetToken, resetPassword, checkEmailAvailability,
} = require("../controllers/authController");

const { protect, admin, requireReAuth } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");
const zeroTrust = require("../middleware/zeroTrustMiddleware");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 login requests per `window` (here, per minute)
    message: {
        success: false,
        message: "Too many login attempts from this IP, please try again after a minute",
        code: "AUTH_429"
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// â”€â”€ Public Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post("/register", register);
router.post("/check-email", checkEmailAvailability);
router.post("/login", loginLimiter, login);
router.post("/verify-2fa", verify2FALogin);
router.post("/refresh", refresh);

// Admin approves / rejects users via secure email link (no auth required â€“ link IS the token)
router.get("/approve/:id", approveUser);
router.get("/reject/:id", rejectUser);

// Password Recovery Flow (Â§Enterprise Security Steps 1-3)
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", validateResetToken);
router.post("/reset-password/:token", resetPassword);

// Diagnostic (internal only)
router.get("/diag/email-test", protect, admin, diagEmailTest);

// â”€â”€ Authenticated User Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.post("/logout-all", protect, logoutAll);
router.post("/change-password", protect, changePassword);
router.put("/profile", protect, updateProfile);
router.get("/activity", protect, getUserActivity);

// 2FA  (available to all authenticated users)
router.post("/2fa/generate", protect, generate2FA);
router.post("/2fa/verify", protect, verify2FA);
router.post("/2fa/disable", protect, disable2FA);

// â”€â”€ Admin-Only Routes (Zero Trust: protect + admin + 2FA) â”€â”€â”€â”€
// Every destructive or privileged admin action requires:
//   1. Valid JWT (protect)
//   2. Admin role fresh from DB (admin)
//   3. 2FA enabled on Admin account (requireAdmin2FA)
//   4. Step-up Auth (requireReAuth) for destructive actions (Â§3.4)
router.get("/users", protect, admin, zeroTrust, getAllUsers);
router.put("/users/:id/promote", protect, admin, zeroTrust, promoteUser);
router.put("/users/:id/demote", protect, admin, zeroTrust, requireReAuth, demoteUser);
router.put("/users/:id/suspend", protect, admin, zeroTrust, suspendUser);
router.put("/users/:id/approve", protect, admin, zeroTrust, approveUserByAdmin);
router.put("/users/:id/reset-password", protect, admin, zeroTrust, requireReAuth, adminResetPassword);
router.put("/users/:id/disable-2fa", protect, admin, zeroTrust, adminDisable2FA);
router.delete("/users/:id", protect, admin, zeroTrust, deleteUser);
router.put("/users/:id/offboard", protect, admin, zeroTrust, requireReAuth, offboardUser);

module.exports = router;


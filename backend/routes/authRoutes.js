/**
 * Auth Routes — IT Asset Tracking System
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
    register, login, logout, getMe, changePassword, updateProfile,
    logoutAll, refresh, generate2FA, verify2FA, disable2FA,
    getAllUsers, promoteUser, demoteUser, suspendUser,
    adminResetPassword, adminDisable2FA, deleteUser,
    approveUser, rejectUser, diagEmailTest, getUserActivity,
    forgotPassword, validateResetToken, resetPassword,
} = require("../controllers/authController");

const { protect, admin, requireReAuth } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");

// ── Public Routes ────────────────────────────────────────────
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

// Admin approves / rejects users via secure email link (no auth required – link IS the token)
router.get("/approve/:id", approveUser);
router.get("/reject/:id", rejectUser);

// Password Recovery Flow (§Enterprise Security Steps 1-3)
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", validateResetToken);
router.post("/reset-password/:token", resetPassword);

// Diagnostic (internal only)
router.get("/diag/email-test", diagEmailTest);

// ── Authenticated User Routes ────────────────────────────────
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

// ── Admin-Only Routes (Zero Trust: protect + admin + 2FA) ────
// Every destructive or privileged admin action requires:
//   1. Valid JWT (protect)
//   2. Admin role fresh from DB (admin)
//   3. 2FA enabled on Admin account (requireAdmin2FA)
//   4. Step-up Auth (requireReAuth) for destructive actions (§3.4)
router.get("/users", protect, admin, requireAdmin2FA, getAllUsers);
router.put("/users/:id/promote", protect, admin, requireAdmin2FA, requireReAuth, promoteUser);
router.put("/users/:id/demote", protect, admin, requireAdmin2FA, requireReAuth, demoteUser);
router.put("/users/:id/suspend", protect, admin, requireAdmin2FA, suspendUser);
router.put("/users/:id/reset-password", protect, admin, requireAdmin2FA, requireReAuth, adminResetPassword);
router.put("/users/:id/disable-2fa", protect, admin, requireAdmin2FA, adminDisable2FA);
router.delete("/users/:id", protect, admin, requireAdmin2FA, requireReAuth, deleteUser);

module.exports = router;
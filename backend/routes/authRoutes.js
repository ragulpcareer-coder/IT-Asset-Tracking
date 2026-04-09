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
    logoutAll, refresh, generate2FA, verify2FA, disable2FA, regenerate2FARecoveryCodes,
    getAllUsers, promoteUser, demoteUser, suspendUser,
    adminResetPassword, adminDisable2FA, deleteUser,
    approveUser, rejectUser, approveUserByAdmin, diagEmailTest, getUserActivity,
    forgotPassword, validateResetToken, resetPassword, checkEmailAvailability, verifyEmail,
} = require("../controllers/authController");

const { protect, admin, requireReAuth } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");
const zeroTrust = require("../middleware/zeroTrustMiddleware");
const rateLimit = require("express-rate-limit");
const validate = require("../middleware/validateRequest");
const {
    registerSchema,
    loginSchema,
    verify2FASchema,
    forgotPasswordSchema,
    checkEmailSchema,
    resetPasswordSchema,
    resetTokenParamsSchema,
    emailVerificationParamsSchema,
    profileUpdateSchema,
    changePasswordSchema,
    twoFactorVerifySchema,
    adminPasswordResetSchema,
    userIdParamsSchema,
    approvalLinkParamsSchema,
    suspendUserSchema,
    paginationQuerySchema,
} = require("../validators/authValidators");
const { diagnosticEmailQuerySchema } = require("../validators/routeValidators");

const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 login requests per `window` (here, per minute)
    message: {
        success: false,
        message: "Too many login attempts from this IP, please try again after a minute",
        errors: { auth: "rate_limited" }
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const twoFactorLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many 2FA attempts from this IP, please try again later",
        errors: { auth: "rate_limited" }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// â”€â”€ Public Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post("/register", validate(registerSchema), register);
router.post("/check-email", validate(checkEmailSchema), checkEmailAvailability);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/verify-2fa", twoFactorLimiter, validate(verify2FASchema), verify2FALogin);
router.post("/refresh", refresh);

// Admin approves / rejects users via secure email link (no auth required â€“ link IS the token)
router.get("/approve/:id/:token", validate(approvalLinkParamsSchema, "params"), approveUser);
router.get("/reject/:id/:token", validate(approvalLinkParamsSchema, "params"), rejectUser);

// Password Recovery Flow (Â§Enterprise Security Steps 1-3)
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.get("/verify-email/:token", validate(emailVerificationParamsSchema, "params"), verifyEmail);
router.get("/reset-password/:token", validate(resetTokenParamsSchema, "params"), validateResetToken);
router.post("/reset-password/:token", validate(resetTokenParamsSchema, "params"), validate(resetPasswordSchema), resetPassword);

// Diagnostic (internal only)
router.get("/diag/email-test", protect, admin, requireAdmin2FA, validate(diagnosticEmailQuerySchema, "query"), diagEmailTest);

// â”€â”€ Authenticated User Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.post("/logout-all", protect, logoutAll);
router.post("/change-password", protect, validate(changePasswordSchema), changePassword);
router.put("/profile", protect, validate(profileUpdateSchema), updateProfile);
router.get("/activity", protect, validate(paginationQuerySchema, "query"), getUserActivity);

// 2FA  (available to all authenticated users)
router.post("/2fa/generate", protect, generate2FA);
router.post("/2fa/verify", protect, twoFactorLimiter, validate(twoFactorVerifySchema), verify2FA);
router.post("/2fa/recovery-codes", protect, requireReAuth, regenerate2FARecoveryCodes);
router.post("/2fa/disable", protect, requireReAuth, disable2FA);

// â”€â”€ Admin-Only Routes (Zero Trust: protect + admin + 2FA) â”€â”€â”€â”€
// Every destructive or privileged admin action requires:
//   1. Valid JWT (protect)
//   2. Admin role fresh from DB (admin)
//   3. 2FA enabled on Admin account (requireAdmin2FA)
//   4. Step-up Auth (requireReAuth) for destructive actions (Â§3.4)
router.get("/users", protect, admin, requireAdmin2FA, zeroTrust, validate(paginationQuerySchema, "query"), getAllUsers);
router.put("/users/:id/promote", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), requireReAuth, promoteUser);
router.put("/users/:id/demote", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), requireReAuth, demoteUser);
router.put("/users/:id/suspend", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), validate(suspendUserSchema), suspendUser);
router.put("/users/:id/approve", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), approveUserByAdmin);
router.put("/users/:id/reset-password", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), validate(adminPasswordResetSchema), requireReAuth, adminResetPassword);
router.put("/users/:id/disable-2fa", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), adminDisable2FA);
router.delete("/users/:id", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), requireReAuth, deleteUser);

module.exports = router;


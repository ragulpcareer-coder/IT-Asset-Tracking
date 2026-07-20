/**
 * Auth Routes — IT Asset Tracking System
 *
 * RBAC Policy:
 *  - User routes:  require protect only
 *  - Admin routes: require protect + admin
 */

"use strict";

const express = require("express");
const router = express.Router();

const {
    register, login, logout, getMe, changePassword, updateProfile,
    logoutAll, refresh,
    getAllUsers, promoteUser, demoteUser, suspendUser,
    adminResetPassword, deleteUser,
    offboardUser, diagEmailTest, getUserActivity,
    forgotPassword, validateResetToken, resetPassword, checkEmailAvailability,
} = require("../controllers/authController");

const { protect, admin } = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");
const validate = require("../middleware/validateRequest");
const {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    checkEmailSchema,
    resetPasswordSchema,
    resetTokenParamsSchema,
    profileUpdateSchema,
    changePasswordSchema,
    adminPasswordResetSchema,
    userIdParamsSchema,
    suspendUserSchema,
    offboardUserSchema,
    paginationQuerySchema,
} = require("../validators/authValidators");
const { diagnosticEmailQuerySchema } = require("../validators/routeValidators");

const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 login requests per window
    message: {
        success: false,
        message: "Too many login attempts from this IP, please try again after a minute",
        errors: { auth: "rate_limited" }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Public Routes ──────────────────────────────────────────
router.post("/register", validate(registerSchema), register);
router.post("/check-email", validate(checkEmailSchema), checkEmailAvailability);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/refresh", refresh);

// Password Recovery Flow
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.get("/reset-password/:token", validate(resetTokenParamsSchema, "params"), validateResetToken);
router.post("/reset-password/:token", validate(resetTokenParamsSchema, "params"), validate(resetPasswordSchema), resetPassword);

// Diagnostic (internal only)
router.get("/diag/email-test", protect, admin, validate(diagnosticEmailQuerySchema, "query"), diagEmailTest);

// ── Authenticated User Routes ────────────────────────────────
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.post("/logout-all", protect, logoutAll);
router.post("/change-password", protect, validate(changePasswordSchema), changePassword);
router.put("/profile", protect, validate(profileUpdateSchema), updateProfile);
router.get("/activity", protect, validate(paginationQuerySchema, "query"), getUserActivity);

// ── Admin-Only Routes (protect + admin) ──────────────────────
router.get("/users", protect, admin, validate(paginationQuerySchema, "query"), getAllUsers);
router.put("/users/:id/promote", protect, admin, validate(userIdParamsSchema, "params"), promoteUser);
router.put("/users/:id/demote", protect, admin, validate(userIdParamsSchema, "params"), demoteUser);
router.put("/users/:id/suspend", protect, admin, validate(userIdParamsSchema, "params"), validate(suspendUserSchema), suspendUser);
router.put("/users/:id/offboard", protect, admin, validate(userIdParamsSchema, "params"), validate(offboardUserSchema), offboardUser);
router.put("/users/:id/reset-password", protect, admin, validate(userIdParamsSchema, "params"), validate(adminPasswordResetSchema), adminResetPassword);
router.delete("/users/:id", protect, admin, validate(userIdParamsSchema, "params"), deleteUser);

module.exports = router;

/**
 * authMiddleware.js
 * Core authentication and admin-guard middleware.
 *
 * - Validates the JWT access token on every protected request.
 * - Re-fetches the user from the DB on every request (never trusts the
 *   token's role claim alone — the DB is the source of truth for role
 *   and active status).
 * - Blocks suspended accounts.
 * - `admin` guard restricts a route to Admin/Super Admin roles.
 */

"use strict";

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const TokenManager = require("../utils/tokenManager");
const { sendError } = require("../utils/apiResponse");

const tokenManager = new TokenManager(
  process.env.JWT_SECRET,
  process.env.REFRESH_SECRET
);

// ─────────────────────────────────────────────────────────────
//  protect – verify JWT and attach the current user to req.user
// ─────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  let token = req.cookies?.jwt;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    const headerToken = req.headers.authorization.split(" ")[1];
    if (headerToken && headerToken !== "undefined" && headerToken !== "null") {
      token = headerToken;
    }
  }

  if (!token) {
    return sendError(res, 401, "Not authorized, no token", { auth: "missing_token" });
  }

  try {
    const verified = tokenManager.verifyAccessToken(token);
    if (!verified.valid) {
      return sendError(res, 401, "Not authorized, token invalid", { auth: "invalid_token" });
    }

    const decoded = verified.decoded;
    const ip = req.ip || req.connection?.remoteAddress;

    // Basic request-body screening: block obvious NoSQL-injection-style
    // payloads and prompt-injection patterns before they reach a controller.
    const { detectMaliciousQuery, detectPromptInjection } = require("../utils/security");
    const hasInjection = detectMaliciousQuery(req.query) || detectMaliciousQuery(req.body);
    const hasPromptInjection = detectPromptInjection(req.query) || detectPromptInjection(req.body);

    if (hasInjection || hasPromptInjection) {
      await AuditLog.create({
        action: hasPromptInjection ? "SECURITY ALERT: AI Prompt Injection Blocked" : "SECURITY ALERT: Injection Attempt Detected",
        performedBy: decoded.email || "System-Wide Guard",
        details: `${hasPromptInjection ? "Adversarial pattern" : "Malicious pattern"} detected in ${req.method} ${req.originalUrl}. Source IP: ${ip}`,
        ip,
      });
      return sendError(
        res,
        403,
        hasPromptInjection
          ? "Request blocked: adversarial input pattern detected"
          : "Request blocked: malicious input pattern detected",
      );
    }

    const user = await User.findById(decoded.userId).select("email role isActive tokenVersion");

    if (!user) {
      return sendError(res, 401, "Not authorized, user not found", { auth: "invalid_user" });
    }

    // Token versioning: lets a password change or explicit "log out
    // everywhere" instantly invalidate any older tokens still in the wild.
    const userVersion = user.tokenVersion || 0;
    const decodedVersion = decoded.tokenVersion || 0;
    if (userVersion !== decodedVersion) {
      return sendError(res, 401, "Session expired. Please log in again.", { auth: "session_revoked" });
    }

    if (user.isActive === false) {
      return sendError(res, 403, "Your account has been suspended by an administrator.", { auth: "account_suspended" });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("[AuthMiddleware] Auth error:", error.message);
    return sendError(res, 401, "Not authorized, token failed", { auth: "token_failed" });
  }
};

// ─────────────────────────────────────────────────────────────
//  admin – allow only Admin/Super Admin roles (must run after protect)
// ─────────────────────────────────────────────────────────────
const admin = async (req, res, next) => {
  if (req.user && ["Super Admin", "Admin"].includes(req.user.role)) {
    return next();
  }

  try {
    await AuditLog.create({
      action: "SECURITY: Admin Route Access Denied",
      performedBy: req.user?.email || "Unknown",
      details: `Non-admin user attempted admin-only endpoint: ${req.method} ${req.originalUrl}`,
      ip: req.ip || req.socket?.remoteAddress,
    });
  } catch (_) { /* audit is best-effort */ }

  return sendError(res, 403, "Forbidden: Administrator access required.", { auth: "admin_required" });
};

module.exports = { protect, admin };

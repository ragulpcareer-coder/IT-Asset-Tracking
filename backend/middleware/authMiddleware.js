/**
 * authMiddleware.js
 * Core Authentication & Admin Guard Middleware.
 *
 * SECURITY POLICY:
 *  - Validates JWT access token on every protected request
 *  - Re-fetches user from DB every request (Zero Trust â€“ never trust the token alone)
 *  - Checks account active status, lock status, and approval on every request
 *  - `admin` guard blocks non-Admin roles with audit logging
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  protect â€“ verify JWT and attach fresh user to req.user
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const protect = async (req, res, next) => {
  let token = req.cookies?.jwt;
  let tokenSource = "cookie";

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    const headerToken = req.headers.authorization.split(" ")[1];
    if (headerToken && headerToken !== "undefined" && headerToken !== "null") {
      token = headerToken;
      tokenSource = "header";
    }
  }

  if (!token) {
    console.log("[AuthMiddleware] Failed: No token found in headers or cookies");
    return sendError(res, 401, "Not authorized, no token", { auth: "missing_token" });
  }

  try {
    const verified = tokenManager.verifyAccessToken(token);
    if (!verified.valid) {
      console.log(`[AuthMiddleware] Failed: Token invalid (${verified.error}). Source: ${tokenSource}, Val: ${token.substring(0, 15)}...`);
      return sendError(res, 401, "Not authorized, token invalid", { auth: "invalid_token" });
    }

    const decoded = verified.decoded;
    const ip = req.ip || req.connection?.remoteAddress;

    // API Request Expiration (Â§6.3)
    const requestTimestamp = req.headers['x-request-timestamp'];
    if (requestTimestamp) {
      const now = Date.now();
      const diff = Math.abs(now - parseInt(requestTimestamp));
      if (diff > 30000) { // 30 seconds tolerance
        console.log("[AuthMiddleware] Failed: Request expired (Signature Replay)");
        return sendError(res, 403, "Security violation: API request expired");
      }
    }

    // Query & Payload Behavior Monitoring (Â§7.2, Â§14, AI Security Category 1/2)
    const { detectMaliciousQuery, detectPromptInjection } = require("../utils/security");
    const hasInjection = detectMaliciousQuery(req.query) || detectMaliciousQuery(req.body);
    const hasPromptInjection = detectPromptInjection(req.query) || detectPromptInjection(req.body);

    if (hasInjection || hasPromptInjection) {
      await AuditLog.create({
        action: hasPromptInjection ? "SECURITY ALERT: AI Prompt Injection Blocked" : "SECURITY ALERT: Injection Attempt Detected",
        performedBy: decoded.email || "System-Wide Guard",
        details: `${hasPromptInjection ? 'Adversarial AI pattern' : 'Malicious logic pattern'} detected in ${req.method} ${req.originalUrl}. Context: ${JSON.stringify(req.body).substring(0, 100)}. Source IP: ${ip}`,
        ip: ip,
      });
      console.log("[AuthMiddleware] Failed: Malicious query/prompt detected");
      return sendError(
        res,
        403,
        hasPromptInjection
          ? "Protocol violation: adversarial prompt patterns detected"
          : "Security violation: malicious request pattern detected"
      );
    }

    // Zero Trust Optimization: Fetch minimal fields required for authorization
    const user = await User.findById(decoded.userId)
      .select("email role isActive isApproved lockUntil lastLoginIp privilegeTokenExpires tokenVersion twoFactorEnabled behavioralMetadata");

    if (!user) {
      console.log(`[AuthMiddleware] Failed: User not found in database for ID ${decoded.userId}`);
      return sendError(res, 401, "Not authorized, user not found", { auth: "invalid_user" });
    }

    // Zero Trust: Device Fingerprint Binding (Â§3.1)
    const clientFingerprint = req.headers['x-device-fingerprint'];
    const trustedDevices = user.behavioralMetadata?.trustedDevices || [];

    if (clientFingerprint && trustedDevices.length > 0 && !trustedDevices.includes(clientFingerprint)) {
      const { recordZeroTrustViolation } = require("../services/correlationEngine");
      recordZeroTrustViolation(user._id, `Unrecognized Device Binding: ${clientFingerprint.substring(0, 8)}...`, ip);
      console.warn(`[ZeroTrust] Violation: Unrecognized device for ${user.email} (${clientFingerprint.substring(0, 8)})`);
      // We don't block yet (monitoring mode), but we log the high-severity alert.
    }

    // Token Versioning: Session Invalidation Check
    const userVersion = user.tokenVersion || 0;
    const decodedVersion = decoded.tokenVersion || 0;
    if (userVersion !== decodedVersion) {
      console.log(`[AuthMiddleware] Failed: Token Version Mismatch (Revoked Session). User: ${userVersion}, Token: ${decodedVersion}`);
      return sendError(res, 401, "Session expired due to security credential updates. Please log in again.", { auth: "session_revoked" });
    }

    // Session Binding to IP - Legacy IP Shift tracking removed.
    // Anomalous IP shifts and Impossible Travels are now securely handled 
    // during Authentication flows via the robust UserSession telematic engine.


    // Time-Based Access Control (Â§12.1) â€” Relaxed for Development and Remote Flexibility
    // if (user.role === "Employee") {
    //   const hour = new Date().getHours();
    //   if (hour < 8 || hour > 19) { // Authorized 8 AM - 7 PM
    //     console.log(`[AuthMiddleware] Failed: Time-Based access denied for Employee. Hour: ${hour}`);
    //     return res.status(403).json({ message: "Access Denied: Your role is restricted to standard business hours (08:00 - 19:00)." });
    //   }
    // }

    // Account suspension check
    if (user.isActive === false) {
      console.log(`[AuthMiddleware] Failed: Account is suspended (isActive=false)`);
      return sendError(res, 403, "Your account has been suspended by an administrator.", { auth: "account_suspended" });
    }

    // Account lock check
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const waitMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      console.log(`[AuthMiddleware] Failed: Account is locked for ${waitMinutes}m`);
      return sendError(res, 403, `Your account is temporarily locked due to failed login attempts. Try again in ${waitMinutes} minute(s).`, { auth: "account_locked" });
    }

    // Approval check (Core Admins inherently bypass this check)
    if (!user.isApproved && !["Super Admin", "Admin"].includes(user.role)) {
      console.log(`[AuthMiddleware] Failed: Account not approved`);
      return sendError(res, 403, "Compliance pending: your account is awaiting administrator approval before accessing platform telemetry.", { auth: "account_pending_approval" });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error(`[AuthMiddleware] EXCEPTION: Auth protect error:`, error.message, error.stack);
    return sendError(res, 401, "Not authorized, token failed", { auth: "token_failed" });
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  admin â€“ allow only Admin role (must run AFTER protect)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const admin = async (req, res, next) => {
  if (req.user && ["Super Admin", "Admin"].includes(req.user.role)) {
    return next();
  }

  // Audit the violation
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

const bcrypt = require("bcryptjs");

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  requireReAuth â€“ step-up authentication for high-risk actions (Â§3.4)
//  Requires `password` in request body.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const requireReAuth = async (req, res, next) => {
  try {
    // Continuous Verification: Check if user has an active privilege window (§2.3)
    if (req.user.privilegeTokenExpires && new Date(req.user.privilegeTokenExpires) > new Date()) {
      return next(); // Still in the 10-minute grace period
    }

    const { confirmPassword } = req.body;
    if (!confirmPassword) {
      return res.status(403).json({
        success: false,
        reauthRequired: true,
        code: "STEP_UP_REQUIRED",
        message: "Step-up authentication required. Please confirm your password to continue."
      });
    }

    // Since req.user was fetched with .select("-password") in protect(),
    // we need to fetch it including password now.
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return sendError(res, 401, "User session lost", { auth: "session_lost" });

    const isMatch = await bcrypt.compare(confirmPassword, user.password);
    if (!isMatch) {
      await AuditLog.create({
        action: "SECURITY ALERT: Step-up Auth Failed",
        performedBy: req.user.email,
        details: `Failed sensitive action re-auth on: ${req.method} ${req.originalUrl}`,
        ip: req.ip || req.socket?.remoteAddress,
      });

      return res.status(403).json({
        success: false,
        reauthRequired: true,
        code: "STEP_UP_REQUIRED",
        message: "Invalid password for step-up authentication."
      });
    }

    // Success - Grant 10-minute Privilege Window (§2.3)
    // Use updateOne to bypass bcrypt pre-save hook (never re-hash password on non-password saves)
    await User.updateOne(
      { _id: user._id },
      { $set: { privilegeTokenExpires: new Date(Date.now() + 10 * 60 * 1000) } }
    );

    await AuditLog.create({
      action: "SECURITY: Privilege Elevated",
      performedBy: user.email,
      details: `Admin privilege elevated for 10 minutes. Action: ${req.method} ${req.originalUrl}`,
      ip: req.ip || req.socket?.remoteAddress,
    });

    next();
  } catch (error) {
    return sendError(res, 500, "Re-authentication system error");
  }
};
module.exports = { protect, admin, requireReAuth };



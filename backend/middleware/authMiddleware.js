/**
 * authMiddleware.js
 * Core Authentication & Admin Guard Middleware.
 *
 * SECURITY POLICY:
 *  - Validates JWT access token on every protected request
 *  - Re-fetches user from DB every request (Zero Trust – never trust the token alone)
 *  - Checks account active status, lock status, and approval on every request
 *  - `admin` guard blocks non-Admin roles with audit logging
 */

"use strict";

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const TokenManager = require("../utils/tokenManager");

const tokenManager = new TokenManager(
  process.env.JWT_SECRET,
  process.env.REFRESH_SECRET
);

// ─────────────────────────────────────────────────────────────
//  protect – verify JWT and attach fresh user to req.user
// ─────────────────────────────────────────────────────────────
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
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const verified = tokenManager.verifyAccessToken(token);
    if (!verified.valid) {
      console.log(`[AuthMiddleware] Failed: Token invalid (${verified.error}). Source: ${tokenSource}, Val: ${token.substring(0, 15)}...`);
      return res.status(401).json({ message: "Not authorized, token invalid", debug: verified.error });
    }

    const decoded = verified.decoded;
    const ip = req.ip || req.connection?.remoteAddress;

    // API Request Expiration (§6.3)
    const requestTimestamp = req.headers['x-request-timestamp'];
    if (requestTimestamp) {
      const now = Date.now();
      const diff = Math.abs(now - parseInt(requestTimestamp));
      if (diff > 30000) { // 30 seconds tolerance
        console.log("[AuthMiddleware] Failed: Request expired (Signature Replay)");
        return res.status(403).json({ message: "Security Violation: API Request Expired (Signature Replay Protection)" });
      }
    }

    // Query & Payload Behavior Monitoring (§7.2, §14, AI Security Category 1/2)
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
      return res.status(403).json({
        message: hasPromptInjection
          ? "Protocol Violation: Adversarial prompt patterns detected. Command execution blocked."
          : "Security Violation: Malicious request pattern detected."
      });
    }

    // Zero Trust Optimization: Fetch minimal fields required for authorization
    const user = await User.findById(decoded.userId)
      .select("email role isActive isApproved lockUntil lastLoginIp privilegeTokenExpires tokenVersion twoFactorEnabled behavioralMetadata");

    if (!user) {
      console.log(`[AuthMiddleware] Failed: User not found in database for ID ${decoded.userId}`);
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    // Token Versioning: Session Invalidation Check
    const userVersion = user.tokenVersion || 0;
    const decodedVersion = decoded.tokenVersion || 0;
    if (userVersion !== decodedVersion) {
      console.log(`[AuthMiddleware] Failed: Token Version Mismatch (Revoked Session). User: ${userVersion}, Token: ${decodedVersion}`);
      return res.status(401).json({ message: "Session expired due to security credential updates. Please log in again.", code: "SESSION_REVOKED" });
    }

    // Session Binding to IP - Legacy IP Shift tracking removed.
    // Anomalous IP shifts and Impossible Travels are now securely handled 
    // during Authentication flows via the robust UserSession telematic engine.


    // Time-Based Access Control (§12.1) — Relaxed for Development and Remote Flexibility
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
      return res.status(403).json({
        message: "Your account has been suspended by an administrator.",
      });
    }

    // Account lock check
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const waitMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      console.log(`[AuthMiddleware] Failed: Account is locked for ${waitMinutes}m`);
      return res.status(403).json({
        message: `Your account is temporarily locked due to failed login attempts. Try again in ${waitMinutes} minute(s).`,
      });
    }

    // Approval check (Core Admins inherently bypass this check)
    if (!user.isApproved && !["Super Admin", "Admin"].includes(user.role)) {
      console.log(`[AuthMiddleware] Failed: Account not approved`);
      return res.status(403).json({
        message: "Compliance Pending: Your account is awaiting administrator approval before accessing platform telemetry.",
        code: "ACCOUNT_PENDING_APPROVAL"
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error(`[AuthMiddleware] EXCEPTION: Auth protect error:`, error.message, error.stack);
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// ─────────────────────────────────────────────────────────────
//  admin – allow only Admin role (must run AFTER protect)
// ─────────────────────────────────────────────────────────────
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

  return res.status(403).json({ message: "Forbidden: Administrator access required." });
};

const bcrypt = require("bcryptjs");

// ─────────────────────────────────────────────────────────────
//  requireReAuth – step-up authentication for high-risk actions (§3.4)
//  Requires `password` in request body.
// ─────────────────────────────────────────────────────────────
const requireReAuth = async (req, res, next) => {
  try {
    // Continuous Verification: Check if user has an active privilege window (§2.3)
    if (req.user.privilegeTokenExpires && new Date(req.user.privilegeTokenExpires) > new Date()) {
      return next(); // Still in the 10-minute grace period
    }

    const { confirmPassword } = req.body;
    if (!confirmPassword) {
      return res.status(401).json({
        reauthRequired: true,
        message: "Step-up Authentication: Please re-enter your password to elevate your privileges (Privilege window: 10 mins)."
      });
    }

    // Since req.user was fetched with .select("-password") in protect(),
    // we need to fetch it including password now.
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "User session lost" });

    const isMatch = await bcrypt.compare(confirmPassword, user.password);
    if (!isMatch) {
      await AuditLog.create({
        action: "SECURITY ALERT: Step-up Auth Failed",
        performedBy: req.user.email,
        details: `Failed sensitive action re-auth on: ${req.method} ${req.originalUrl}`,
        ip: req.ip || req.socket?.remoteAddress,
      });

      return res.status(401).json({ message: "Invalid password – re-authentication failed." });
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
    res.status(500).json({ message: "Re-authentication system error" });
  }
};

module.exports = { protect, admin, requireReAuth };

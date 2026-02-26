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

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const verified = tokenManager.verifyAccessToken(token);
    if (!verified.valid) {
      return res.status(401).json({ message: "Not authorized, token invalid" });
    }

    const decoded = verified.decoded;
    const ip = req.ip || req.connection?.remoteAddress;

    // API Request Expiration (§6.3)
    const requestTimestamp = req.headers['x-request-timestamp'];
    if (requestTimestamp) {
      const now = Date.now();
      const diff = Math.abs(now - parseInt(requestTimestamp));
      if (diff > 30000) { // 30 seconds tolerance
        return res.status(403).json({ message: "Security Violation: API Request Expired (Signature Replay Protection)" });
      }
    }

    // Query Behavior Monitoring (§7.2, §14)
    const { detectMaliciousQuery } = require("../utils/security");
    if (detectMaliciousQuery(req.query) || detectMaliciousQuery(req.body)) {
        await AuditLog.create({
            action: "SECURITY ALERT: Injection Attempt Detected",
            performedBy: decoded.email || "System-Wide Guard",
            details: `Malicious pattern detected in ${req.method} ${req.originalUrl}. Source IP: ${ip}`,
            ip: ip,
        });
        return res.status(403).json({ message: "Security Violation: Malicious request pattern detected." });
    }

    // Zero Trust: always fetch fresh from DB
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    // Session Binding to IP (§11.1) - Extreme Defense Mode
    if (user.lastLoginIp && user.lastLoginIp !== ip) {
      await AuditLog.create({
        action: "SECURITY: Session Hijack Detection",
        performedBy: user.email,
        details: `Session IP mismatch. Expected: ${user.lastLoginIp}, Got: ${ip}. Terminating context.`,
        ip: ip,
      });
      return res.status(401).json({ message: "Session invalid: Location change detected mid-session." });
    }

    // Time-Based Access Control (§12.1)
    if (user.role === "Employee") {
      const hour = new Date().getHours();
      if (hour < 8 || hour > 19) { // Authorized 8 AM - 7 PM
        return res.status(403).json({ message: "Access Denied: Your role is restricted to standard business hours (08:00 - 19:00)." });
      }
    }

    // Account suspension check
    if (user.isActive === false) {
      return res.status(403).json({
        message: "Your account has been suspended by an administrator.",
      });
    }

    // Account lock check
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const waitMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(403).json({
        message: `Your account is temporarily locked due to failed login attempts. Try again in ${waitMinutes} minute(s).`,
      });
    }

    // Approval check (Core Admins inherently bypass this check)
    if (!user.isApproved && !["Super Admin", "Admin"].includes(user.role)) {
      return res.status(403).json({
        message: "Your account is pending administrator approval.",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("Auth protect error:", error.message);
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
        ip: req.ip || req.connection?.remoteAddress,
      });

      return res.status(401).json({ message: "Invalid password – re-authentication failed." });
    }

    // Success - Grant 10-minute Privilege Window (§2.3)
    user.privilegeTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await AuditLog.create({
      action: "SECURITY: Privilege Elevated",
      performedBy: user.email,
      details: `Admin privilege elevated for 10 minutes. Action: ${req.method} ${req.originalUrl}`,
      ip: req.ip || req.connection?.remoteAddress,
    });

    next();
  } catch (error) {
    res.status(500).json({ message: "Re-authentication system error" });
  }
};

module.exports = { protect, admin, requireReAuth };

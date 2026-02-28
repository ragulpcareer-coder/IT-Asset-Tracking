/**
 * ============================================================
 *  ENTERPRISE RBAC MIDDLEWARE — IT Asset Tracking System
 *  POLICY: Least Privilege | Zero Trust | Privilege Separation
 * ============================================================
 *
 * ROLES:
 *   Admin – full control of assets, users, logs, settings
 *   Employee – read ONLY their own assigned assets; nothing else
 *
 * ZERO TRUST RULE: Backend ALWAYS re-validates role from DB.
 *   Never trust the frontend or token alone.
 */

"use strict";

const User = require("../models/User");
const AuditLog = require("../models/AuditLog");

// ─────────────────────────────────────────────────────────────
//  PERMISSION MATRIX
//  Each role maps resource → allowed actions.
//  Standard "Employee" access is intentionally minimal.
// ─────────────────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  "Super Admin": {
    users: ["create", "read", "update", "delete", "suspend", "promote", "demote", "reset-password", "change-role"],
    assets: ["create", "read", "update", "delete", "assign", "reassign", "transfer", "bulk-upload", "export", "scan", "bypass-abac"],
    auditLogs: ["read", "export"],
    reports: ["read", "create", "delete", "export"],
    settings: ["read", "update"],
    system: ["backup", "restore", "configure"],
  },
  "Admin": {
    users: ["create", "read", "update", "suspend", "change-role", "reset-password"],
    assets: ["create", "read", "update", "delete", "assign", "reassign", "transfer", "bulk-upload", "export", "scan", "bypass-abac"],
    auditLogs: ["read", "export"],
    reports: ["read", "create", "export"],
    settings: ["read"],
    system: [],
  },
  "Asset Manager": {
    users: ["read"],
    assets: ["create", "read", "update", "assign", "reassign", "transfer", "bulk-upload", "export"],
    auditLogs: [],
    reports: ["read", "create", "export"],
    settings: ["read-self"],
    system: [],
  },
  "Security Auditor": {
    users: ["read"],
    assets: ["read", "export"],
    auditLogs: ["read", "export"],
    reports: ["read", "export"],
    settings: ["read-self"],
    system: [],
  },
  "Manager": {
    users: ["read"],
    assets: ["read", "export"],
    auditLogs: [],
    reports: ["read", "create", "export"],
    settings: ["read-self"],
    system: [],
  },
  "Employee": {
    assets: ["read"],
    users: ["read-self"],
    settings: ["read-self", "update-self"],
    system: [],
  },
  "Guest": {
    assets: ["read"],
    users: [],
    settings: [],
    system: [],
  },
};

// ─────────────────────────────────────────────────────────────
//  HELPER: Check permission
// ─────────────────────────────────────────────────────────────
const hasPermission = (role, resource, action) => {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms || !perms[resource]) return false;
  return perms[resource].includes(action);
};

// ─────────────────────────────────────────────────────────────
//  MIDDLEWARE: authorizeResource(resource, action)
//  Verifies the authenticated user's role has the given action
//  on the given resource. Logs every decision.
// ─────────────────────────────────────────────────────────────
const authorizeResource = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized – no session" });
      }

      // Zero-Trust: Re-fetch role fresh from DB, never trust the token role alone
      const freshUser = await User.findById(req.user._id).select("role isActive isTwoFactorEnabled");
      if (!freshUser || freshUser.isActive === false) {
        return res.status(403).json({ message: "Account suspended or not found" });
      }

      const userRole = freshUser.role || "Employee";

      // Location-Based Access (§12.2): High-Assurance Admin IP Restriction
      const isPrivileged = ["Super Admin", "Admin", "Asset Manager", "Security Auditor"].includes(userRole);
      const isWriteAction = action !== "read" && action !== "read-self";

      if (isPrivileged && isWriteAction) {
        const AUTHORIZED_OFFICE_IPS = process.env.OFFICE_IP_WHITELIST || "127.0.0.1,::1,::ffff:127.0.0.1"; // Default to localhost for dev (§12.2)
        const currentIp = req.ip || req.connection?.remoteAddress;

        if (!AUTHORIZED_OFFICE_IPS.split(',').includes(currentIp)) {
          await AuditLog.create({
            action: "SECURITY: Geofencing Violation",
            performedBy: req.user.email,
            details: `Privileged ACTION ${action} blocked. IP ${currentIp} is not in authorized office range (§12.2).`,
            ip: currentIp
          });
          return res.status(403).json({ message: "Security Violation: Administrative actions are globally restricted to authorized office networks only." });
        }
      }

      if (!hasPermission(userRole, resource, action)) {
        await AuditLog.create({
          action: "RBAC: Authorization Denied",
          performedBy: req.user.email || "unknown",
          details: `[${userRole}] attempted forbidden ${action} on ${resource} — ${req.method} ${req.originalUrl}`,
          ip: req.ip || req.socket?.remoteAddress,
          meta: { resource, action, url: req.originalUrl },
        });

        return res.status(403).json({
          message: `Forbidden: Your role (${userRole}) cannot perform '${action}' on '${resource}'.`,
        });
      }

      // Admin Activity Recording (§3.2): Record EVERY admin action, including READS
      if (isPrivileged) {
        await AuditLog.create({
          action: isWriteAction ? "RBAC: Action Authorized" : "RBAC: Access Log",
          performedBy: req.user.email || "unknown",
          details: `[${userRole}] authorized: ${action} on ${resource} (${req.method} ${req.originalUrl})`,
          ip: req.ip || req.socket?.remoteAddress,
          meta: { resource, action },
        });
      } else if (isWriteAction) {
        // Still log standard user writes
        await AuditLog.create({
          action: "RBAC: Action Authorized",
          performedBy: req.user.email || "unknown",
          details: `[${userRole}] authorized: ${action} on ${resource}`,
          ip: req.ip || req.socket?.remoteAddress,
          meta: { resource, action },
        });
      }

      req.authorizedFor = { resource, action, role: userRole };
      next();
    } catch (error) {
      console.error("RBAC authorizeResource error:", error);
      res.status(500).json({ message: "Authorization check failed" });
    }
  };
};

// ─────────────────────────────────────────────────────────────
//  MIDDLEWARE: authorizeRoles(...roles)
//  Quick role-allowlist check.  e.g. authorizeRoles("Admin")
// ─────────────────────────────────────────────────────────────
const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Zero-Trust re-fetch
    const freshUser = await User.findById(req.user._id).select("role isActive");
    if (!freshUser || freshUser.isActive === false) {
      return res.status(403).json({ message: "Account suspended or not found" });
    }

    if (!roles.includes(freshUser.role)) {
      await AuditLog.create({
        action: "RBAC: Role Access Denied",
        performedBy: req.user.email || "unknown",
        details: `[${freshUser.role}] tried to access route restricted to [${roles.join(", ")}]: ${req.originalUrl}`,
        ip: req.ip || req.socket?.remoteAddress,
      });
      return res.status(403).json({
        message: `Forbidden: Only ${roles.join(", ")} can access this endpoint.`,
      });
    }

    req.user.role = freshUser.role; // sync token role with DB role
    next();
  };
};

// ─────────────────────────────────────────────────────────────
//  MIDDLEWARE: requireAdmin2FA
//  Admins MUST have 2FA enabled. Block the request if they don't.
//  This applies to all privileged / destructive operations.
// ─────────────────────────────────────────────────────────────
const requireAdmin2FA = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Only enforce on Privileged accounts (§2.1)
    if (!["Super Admin", "Admin", "Security Auditor"].includes(req.user.role)) return next();

    const freshUser = await User.findById(req.user._id).select("isTwoFactorEnabled role");
    if (!freshUser) return res.status(401).json({ message: "User not found" });

    if (!freshUser.isTwoFactorEnabled) {
      try {
        await AuditLog.create({
          action: "SECURITY: Admin 2FA Not Configured",
          performedBy: req.user.email || "unknown",
          details: `Admin account without 2FA attempted privileged action: ${req.originalUrl}`,
          ip: req.ip || req.socket?.remoteAddress || "0.0.0.0",
        });
      } catch (auditErr) { /* Ignore audit failure to not crash the request cycle */ }

      return res.status(403).json({
        message: "Security Policy Violation: Administrator accounts must enable Two-Factor Authentication (2FA) before performing privileged actions. Please enable 2FA in Settings.",
        code: "ADMIN_2FA_REQUIRED",
      });
    }

    next();
  } catch (error) {
    console.error("[RBAC] requireAdmin2FA error:", error);
    next(new Error(`2FA enforcement check failed: ${error.message}`));
  }
};

// ─────────────────────────────────────────────────────────────
//  MIDDLEWARE: verifyOwnership(ModelName, ownerField)
//  Ensures a standard User can only access their own resources.
//  Admins bypass this check.
// ─────────────────────────────────────────────────────────────
const verifyOwnership = (modelName, ownerField = "userId") => {
  return async (req, res, next) => {
    try {
      const userId = String(req.user._id || req.user.id);
      const resourceId = req.params.id;

      // Super Admins, Admins, and Auditors bypass ownership check
      if (["Super Admin", "Admin", "Auditor"].includes(req.user.role)) return next();

      const Model = require(`../models/${modelName}`);
      const resource = await Model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({ message: `${modelName} not found` });
      }

      const resourceOwner = String(resource[ownerField]);
      if (resourceOwner !== userId) {
        await AuditLog.create({
          action: "RBAC: Unauthorized Ownership Access Attempt",
          performedBy: req.user.email || "unknown",
          details: `User tried to access ${modelName} owned by another user. ResourceId: ${resourceId}`,
          ip: req.ip || req.socket?.remoteAddress,
          resourceId,
        });

        return res.status(403).json({
          message: `Forbidden: You do not have access to this ${modelName}.`,
        });
      }

      next();
    } catch (error) {
      console.error("verifyOwnership error:", error);
      res.status(500).json({ message: "Ownership verification failed" });
    }
  };
};

// ─────────────────────────────────────────────────────────────
//  MIDDLEWARE: blockStandardUserAdminAPI
//  Hard block: Returns 403 if a standard User reaches any
//  admin-only API endpoint. Defense-in-depth layer.
// ─────────────────────────────────────────────────────────────
const blockStandardUserAdminAPI = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  if (!["Super Admin", "Admin"].includes(req.user.role)) {
    AuditLog.create({
      action: "SECURITY: Standard User Admin API Access Blocked",
      performedBy: req.user.email || "unknown",
      details: `Standard user attempted to reach admin API: ${req.method} ${req.originalUrl}`,
      ip: req.ip || req.socket?.remoteAddress,
    }).catch(() => { });

    return res.status(403).json({
      message: "403 Forbidden: This endpoint is restricted to administrators only.",
    });
  }

  next();
};

// ─────────────────────────────────────────────────────────────
//  Get permission matrix (for frontend RBAC UI)
// ─────────────────────────────────────────────────────────────
const getPermissionMatrix = (req, res) => {
  const userRole = req.user?.role || "Employee";
  res.json({
    role: userRole,
    permissions: ROLE_PERMISSIONS[userRole] || {},
    allRoles: Object.keys(ROLE_PERMISSIONS),
  });
};

// ─────────────────────────────────────────────────────────────
//  MIDDLEWARE: verifyABAC (Attribute-Based Access Control)
//  Enforces fine-grained department-level access (§3.2)
// ─────────────────────────────────────────────────────────────
const Asset = require("../models/Asset");
const verifyABAC = async (req, res, next) => {
  try {
    // Super Admins and Admins bypass ABAC by policy (§3.2 bypass-abac)
    if (["Super Admin", "Admin"].includes(req.user.role)) return next();

    // If accessing a specific asset via ID
    if (req.params.id) {
      const asset = await Asset.findById(req.params.id);
      if (!asset) return res.status(404).json({ message: "Asset not found" });

      // Check Department Alignment
      const userDept = req.user.department || "General";
      const assetDept = asset.location?.department || "General";

      if (userDept !== assetDept && !["Security Auditor"].includes(req.user.role)) {
        await AuditLog.create({
          action: "ABAC: Department Violation",
          performedBy: req.user.email,
          details: `User from [${userDept}] tried to access asset from [${assetDept}]`,
          ip: req.ip || req.connection?.remoteAddress,
        });

        return res.status(403).json({
          message: `ABAC Denied: Your department (${userDept}) does not match the asset department (${assetDept}).`
        });
      }
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "ABAC Verification Error" });
  }
};

module.exports = {
  ROLE_PERMISSIONS,
  hasPermission,
  authorizeResource,
  authorizeRoles,
  requireAdmin2FA,
  verifyOwnership,
  blockStandardUserAdminAPI,
  verifyABAC,
  getPermissionMatrix,
};

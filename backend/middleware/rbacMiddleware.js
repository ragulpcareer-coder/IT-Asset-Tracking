/**
 * Advanced RBAC (Role-Based Access Control) Middleware
 * 
 * Features:
 * - Role-based permission enforcement
 * - Resource-level authorization
 * - Permission matrix validation
 * - Audit trail for authorization checks
 */

const AuditLog = require("../models/AuditLog");

/**
 * Role permission matrix
 * Defines what actions each role can perform on which resources
 */
const ROLE_PERMISSIONS = {
  Admin: {
    users: ["create", "read", "update", "delete"],
    assets: ["create", "read", "update", "delete", "reassign"],
    auditLogs: ["read", "export"],
    reports: ["read", "create", "delete"],
    settings: ["read", "update"],
  },
  Manager: {
    users: ["read", "update"],
    assets: ["read", "update", "reassign"],
    auditLogs: ["read"],
    reports: ["read", "create"],
    settings: ["read"],
  },
  User: {
    users: ["read"], // only self
    assets: ["read"],
    auditLogs: ["read"], // only own actions
    reports: ["read"],
    settings: ["read"], // only own settings
  },
};

/**
 * Check if role has permission for action
 */
const hasPermission = (role, resource, action) => {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  if (!permissions[resource]) return false;
  return permissions[resource].includes(action);
};

/**
 * Middleware: Verify role has permission
 * Usage: authorizeResource("assets", "update")(req, res, next)
 */
const authorizeResource = (resource, action) => {
  return async (req, res, next) => {
    try {
      // User must be authenticated (authMiddleware should run first)
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userRole = req.user.role || "User";

      // Check permission
      if (!hasPermission(userRole, resource, action)) {
        // Log failed authorization attempt
        await AuditLog.create({
          action: "Authorization Denied",
          performedBy: req.user.email,
          resource,
          requestedAction: action,
          userRole,
          details: `${userRole} attempted unauthorized ${action} on ${resource}`,
          ip: req.ip || req.connection.remoteAddress,
          status: "denied",
          createdAt: new Date(),
        });

        return res.status(403).json({
          message: `Forbidden: ${userRole} cannot ${action} ${resource}`,
        });
      }

      // Log successful authorization
      await AuditLog.create({
        action: "Authorization Granted",
        performedBy: req.user.email,
        resource,
        requestedAction: action,
        userRole,
        details: `${userRole} authorized for ${action} on ${resource}`,
        ip: req.ip || req.connection.remoteAddress,
        status: "granted",
        createdAt: new Date(),
      });

      req.authorizedFor = { resource, action };
      next();
    } catch (error) {
      console.error("RBAC error:", error);
      res.status(500).json({ message: "Authorization check failed" });
    }
  };
};

/**
 * Middleware: Verify ownership (user can only access own resources)
 * Usage: verifyOwnership("assets", "userId")(req, res, next)
 * 
 * This ensures users can't access other users' data even if they have role permission
 */
const verifyOwnership = (model, ownerField = "userId") => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id || req.user.id;
      const resourceId = req.params.id;

      // Admins bypass ownership check
      if (req.user.role === "Admin") {
        return next();
      }

      // Find resource
      const Model = require(`../models/${model}`);
      const resource = await Model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({ message: `${model} not found` });
      }

      // Check ownership
      const resourceOwner = String(resource[ownerField]);
      const requestingUser = String(userId);

      if (resourceOwner !== requestingUser) {
        await AuditLog.create({
          action: "Unauthorized Access Attempt",
          performedBy: req.user.email,
          resource: model,
          resourceId,
          details: `User attempted to access ${model} owned by another user`,
          ip: req.ip || req.connection.remoteAddress,
          status: "denied",
          createdAt: new Date(),
        });

        return res.status(403).json({
          message: `Forbidden: You don't have access to this ${model}`,
        });
      }

      next();
    } catch (error) {
      console.error("Ownership check error:", error);
      res.status(500).json({ message: "Ownership verification failed" });
    }
  };
};

/**
 * Middleware: Multi-role authorization
 * Usage: authorizeRoles("Admin", "Manager")(req, res, next)
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: Only ${roles.join(", ")} can access this`,
      });
    }

    next();
  };
};

/**
 * Get permission matrix (for frontend RBAC UI)
 */
const getPermissionMatrix = (req, res) => {
  const userRole = req.user?.role || "User";
  res.json({
    role: userRole,
    permissions: ROLE_PERMISSIONS[userRole] || {},
    allRoles: Object.keys(ROLE_PERMISSIONS),
  });
};

module.exports = {
  ROLE_PERMISSIONS,
  hasPermission,
  authorizeResource,
  verifyOwnership,
  authorizeRoles,
  getPermissionMatrix,
};

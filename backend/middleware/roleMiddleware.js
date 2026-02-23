const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    // Super-admin override
    if (req.user.role === 'Admin') return next();

    if (!roles.includes(req.user.role)) {
      const AuditLog = require("../models/AuditLog");
      await AuditLog.create({
        action: "Security Violation: Access Denied",
        performedBy: req.user.email,
        details: `Unauthorized attempt to access restricted route: ${req.originalUrl} (Required: ${roles.join(', ')})`,
        ip: req.ip || req.connection.remoteAddress,
      });
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};

module.exports = authorizeRoles;

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const TokenManager = require("../utils/tokenManager");

const tokenManager = new TokenManager(process.env.JWT_SECRET, process.env.REFRESH_SECRET);

const protect = async (req, res, next) => {
  let token = req.cookies.jwt;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (token) {
    try {
      const verified = tokenManager.verifyAccessToken(token);
      if (!verified.valid) {
        return res.status(401).json({ message: 'Not authorized, token invalid' });
      }

      const decoded = verified.decoded;
      const user = await User.findById(decoded.userId).select("-password");

      if (!user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }

      if (user.isActive === false) {
        return res.status(403).json({ message: "Your account has been suspended by an administrator." });
      }

      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

const admin = async (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    next();
  } else {
    const AuditLog = require("../models/AuditLog");
    await AuditLog.create({
      action: "Security Violation: Admin Access Denied",
      performedBy: req.user?.email || "Unknown",
      details: `Unauthorized attempt to access Admin-only route: ${req.originalUrl}`,
      ip: req.ip || req.connection.remoteAddress,
    });
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin };

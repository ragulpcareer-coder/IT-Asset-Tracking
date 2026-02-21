const jwt = require("jsonwebtoken");
const User = require("../models/User");
const TokenManager = require("../utils/tokenManager");

const tokenManager = new TokenManager(process.env.JWT_SECRET, process.env.REFRESH_SECRET);

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];


      const verified = tokenManager.verifyAccessToken(token);
      if (!verified.valid) {
        return res.status(401).json({ message: 'Not authorized, token invalid' });
      }

      const decoded = verified.decoded;

      req.user = await User.findById(decoded.userId).select("-password");

      return next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin };

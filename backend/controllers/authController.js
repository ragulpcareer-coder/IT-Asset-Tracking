const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");
const RefreshToken = require("../models/RefreshToken");
const UserActivity = require("../models/UserActivity");
const TokenManager = require("../utils/tokenManager");
const UserSession = require("../models/UserSession");
const { getGeoLocation } = require("../utils/geoIpService");
const {
  validatePasswordStrength,
  isValidEmail,
  RateLimiter,
  sanitizeInput,
} = require("../utils/security");
const crypto = require("crypto");
const logger = require("../utils/logger");
const PasswordResetToken = require("../models/PasswordResetToken");
const { sendPasswordResetEmail } = require("../utils/emailService");
const correlationEngine = require("../services/correlationEngine");
const { extractClientIp } = require("../utils/clientIp");
const { sendError, sendSuccess } = require("../utils/apiResponse");

// Token manager instance (uses env secrets)
const tokenManager = new TokenManager(process.env.JWT_SECRET, process.env.REFRESH_SECRET);

if (!process.env.JWT_SECRET) console.error("[BOOT] FATAL: JWT_SECRET is missing!");

const getAccessCookieOptions = () => {
  const isDev = process.env.NODE_ENV === "development";
  return {
    httpOnly: true,
    secure: !isDev,
    sameSite: !isDev ? "none" : "strict",
    maxAge: 15 * 60 * 1000,
    path: "/",
  };
};

const getRefreshCookieOptions = () => {
  const isDev = process.env.NODE_ENV === "development";
  return {
    httpOnly: true,
    secure: !isDev,
    sameSite: !isDev ? "none" : "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth/refresh",
  };
};

const BCRYPT_ROUNDS = 12;
const getClientIp = (req) => extractClientIp(req);

const setAuthCookies = (res, tokenPair) => {
  res.cookie("jwt", tokenPair.accessToken, getAccessCookieOptions());
  res.cookie("refreshToken", tokenPair.refreshToken, getRefreshCookieOptions());
};

const clearAuthCookies = (res) => {
  res.clearCookie("jwt", getAccessCookieOptions());
  res.clearCookie("refreshToken", getRefreshCookieOptions());
};

const getRefreshTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.refreshToken;
  if (cookieToken) return cookieToken;
  return req.body?.refreshToken || null;
};

const logUserActivity = async (userId, actionType, description, req) => {
  try {
    const ipAddress = getClientIp(req);
    const deviceInfo = {
      userAgent: req.get("User-Agent"),
    };
    await UserActivity.create({ userId, actionType, description, ipAddress, deviceInfo });
  } catch (err) {
    console.error("Failed to log user activity:", err.message);
  }
};

const loginLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts / 15 min per IP
const registerLimiter = new RateLimiter(3, 60 * 60 * 1000); // 3 attempts / hour per IP

// ─────────────────────────────────────────────────────────────
// @desc    Register new user — first account becomes Super Admin,
//          everyone after that is an Employee. No approval gate: a
//          successful registration logs the user in immediately.
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const ip = getClientIp(req);

    if (registerLimiter.isLimited(ip)) {
      return sendError(res, 403, "Too many registration attempts. Please try again later.", { auth: "rate_limited" });
    }

    if (!name || !email || !password) {
      return sendError(res, 400, "Please provide all required fields", {
        name: "required", email: "required", password: "required",
      });
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    if (!isValidEmail(sanitizedEmail)) {
      return sendError(res, 400, "Invalid email format", { email: "must_be_valid_email" });
    }

    const passwordStrength = validatePasswordStrength(password);
    if (!passwordStrength.isStrong) {
      return sendError(res, 400, "Password must contain uppercase, lowercase, number, and special character.", {
        password: passwordStrength.feedback.join(", "),
      });
    }

    if (sanitizedName.length < 3 || sanitizedName.length > 100) {
      return sendError(res, 400, "Full name must be between 3 and 100 characters", { name: "length_out_of_range" });
    }

    const userExists = await User.findOne({ email: sanitizedEmail }).select("_id").lean();
    if (userExists) {
      return sendError(res, 400, "Email already registered", { email: "already_registered" });
    }

    const hasUsers = await User.exists({});
    const assignedRole = hasUsers ? "Employee" : "Super Admin";

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await User.create({
      name: sanitizedName,
      email: sanitizedEmail,
      password: hashedPassword,
      role: assignedRole,
    });

    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role, user.tokenVersion);

    setImmediate(async () => {
      try {
        await Promise.all([
          AuditLog.create({
            action: "User Registered",
            performedBy: sanitizedEmail,
            details: `New user registered: ${sanitizedName}${assignedRole === "Super Admin" ? " (first account, assigned Super Admin)" : ""}`,
            ip,
          }),
          RefreshToken.create({
            tokenId: pair.refreshTokenId,
            family: pair.refreshTokenFamily,
            user: user._id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
          logUserActivity(user._id, "PROFILE_UPDATE", "Account created.", req),
        ]);
      } catch (logErr) {
        logger.error("Registration logging error:", logErr.message);
      }
    });

    setAuthCookies(res, pair);

    return sendSuccess(res, 201, "Registration successful.", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    logger.error("Registration error:", error);
    return sendError(res, 500, "Registration failed. Please try again.", { registration: "unexpected_error" });
  }
};

const checkEmailAvailability = async (req, res) => {
  try {
    const email = sanitizeInput(req.body?.email || "").toLowerCase();
    if (!email || !isValidEmail(email)) {
      return sendError(res, 400, "Invalid email format", { email: "must_be_valid_email" });
    }

    const exists = await User.exists({ email });
    return res.status(200).json({
      success: true,
      available: !exists,
      message: exists ? "Email is already registered" : "Email is available",
    });
  } catch (error) {
    return sendError(res, 500, "Unable to validate email right now", { email: "validation_unavailable" });
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Login
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const email = sanitizeInput(req.body?.email || "").toLowerCase();
    const password = req.body?.password;
    const ip = getClientIp(req);

    if (loginLimiter.isLimited(ip)) {
      return sendError(res, 403, "Too many login attempts. Please try again later.", { auth: "rate_limited" });
    }

    if (!email || !password) {
      return sendError(res, 400, "Email and password are required", { email: "required", password: "required" });
    }

    if (!isValidEmail(email)) {
      return sendError(res, 400, "Please provide a valid email address", { email: "must_be_valid_email" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 401, "Invalid email or password", { auth: "invalid_credentials" });
    }

    if (user.isActive === false) {
      return sendError(res, 403, "Account is suspended.", { auth: "account_suspended" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      correlationEngine.checkBruteForce(ip, email, {
        userAgent: req.headers["user-agent"] || "unknown",
      });
      return sendError(res, 401, "Invalid email or password", { auth: "invalid_credentials" });
    }

    const userAgent = req.headers["user-agent"] || "unknown";
    const geoData = await getGeoLocation(ip);

    const lastSession = await UserSession.findOne({ userId: user._id }).sort({ loginTime: -1 }).lean();
    if (lastSession) {
      const prevCountry = lastSession.country || "Unknown";
      const currCountry = geoData.country || "Unknown";
      const countryChanged =
        prevCountry !== currCountry &&
        !["Unknown", "Internal/Local", "Localhost"].includes(prevCountry) &&
        !["Unknown", "Internal/Local", "Localhost"].includes(currCountry);

      if (countryChanged) {
        await correlationEngine.triggerAlert("AI_FLAGGED_ANOMALY", {
          severity: "CRITICAL",
          message: `Impossible travel detected: ${prevCountry} -> ${currCountry}`,
          ip,
          userId: user._id,
          metadata: { previousCountry: prevCountry, currentCountry: currCountry, previousIp: lastSession.ipAddress, currentUserAgent: userAgent },
        });
      } else if (lastSession.ipAddress !== ip && lastSession.userAgent !== userAgent) {
        await correlationEngine.triggerAlert("SUSPICIOUS_IP", {
          severity: "HIGH",
          message: "Login from new device and network signature detected.",
          ip,
          userId: user._id,
          metadata: { previousIp: lastSession.ipAddress, previousUserAgent: lastSession.userAgent, currentUserAgent: userAgent },
        });
      }
    }

    await UserSession.create({ userId: user._id, ipAddress: ip, userAgent, country: geoData.country, city: geoData.city });

    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role, user.tokenVersion);

    setImmediate(async () => {
      try {
        await Promise.all([
          User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date(), lastLoginIp: ip } }),
          RefreshToken.deleteMany({ user: user._id }),
          RefreshToken.create({
            tokenId: pair.refreshTokenId,
            family: pair.refreshTokenFamily,
            user: user._id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
          logUserActivity(user._id, "LOGIN", "Successful authentication.", req),
        ]);
        correlationEngine.checkPrivilegeEscalation(user._id, ip, !lastSession);
      } catch (postLoginErr) {
        console.error("Post-login update error:", postLoginErr.message);
      }
    });

    clearAuthCookies(res);
    setAuthCookies(res, pair);

    return sendSuccess(res, 200, "Sign in successful", {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        preferences: user.preferences,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return sendError(res, 500, "Internal server error during login", { auth: "unexpected_error" });
  }
};

// @desc Get current user
// @route GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("name email role preferences phone department location")
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Change password
// @route POST /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Please provide current and new password" });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.isStrong) {
      return res.status(400).json({ success: false, message: "Password does not meet security requirements", feedback: strength.feedback, score: strength.score });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "New password must be different from current password" });
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await Promise.all([
      RefreshToken.deleteMany({ user: user._id }),
      logUserActivity(user._id, "PASSWORD_CHANGE", "User changed their password", req),
      AuditLog.create({ action: "PASSWORD_CHANGED", performedBy: user.email, details: "Password changed and active sessions invalidated.", ip: getClientIp(req) }),
    ]);

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to change password" });
  }
};

// @desc Update profile
// @route PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { name, preferences, phone, department, location } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (department) user.department = department;
    if (location) user.location = location;
    if (preferences) {
      user.preferences = { ...(user.preferences || {}), ...preferences };
      user.markModified("preferences");
    }

    await user.save();
    await logUserActivity(user._id, "PROFILE_UPDATE", "User updated their profile information", req);

    res.json({ success: true, user, message: "Profile updated successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Logout current session
// @route POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      const verified = tokenManager.verifyRefreshToken(refreshToken);
      if (verified.valid) {
        await RefreshToken.updateOne(
          { tokenId: verified.decoded.tokenId, family: verified.decoded.family, user: verified.decoded.userId },
          { revoked: true },
        );
      }
    }

    clearAuthCookies(res);

    if (req.user && req.user._id) {
      await logUserActivity(req.user._id, "LOGOUT", "User logged out successfully.", req).catch(() => {});
    }

    return sendSuccess(res, 200, "Logout successful");
  } catch (err) {
    console.error("Logout error:", err);
    return sendError(res, 500, "Logout processing error", { auth: "logout_failed" });
  }
};

// @desc Logout from all sessions/devices
// @route POST /api/auth/logout-all
const logoutAll = async (req, res) => {
  try {
    await RefreshToken.updateMany({ user: req.user._id }, { revoked: true });
    clearAuthCookies(res);

    await AuditLog.create({
      action: "Logout All",
      performedBy: req.user.email || req.user._id,
      details: "User logged out from all sessions",
      ip: req.ip || req.connection.remoteAddress,
    });

    return sendSuccess(res, 200, "Logged out from all sessions successfully");
  } catch (error) {
    return sendError(res, 500, "Failed to log out from all sessions", { auth: "logout_all_failed" });
  }
};

// @desc Refresh access token using a refresh token
// @route POST /api/auth/refresh
const refresh = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) return sendError(res, 400, "Refresh token required", { refreshToken: "required" });

    const verified = tokenManager.verifyRefreshToken(refreshToken);
    if (!verified.valid) return sendError(res, 401, "Invalid refresh token", { refreshToken: "invalid" });

    const decoded = verified.decoded;
    const stored = await RefreshToken.findOne({ tokenId: decoded.tokenId, family: decoded.family, user: decoded.userId });

    // Reuse detection: a refresh token presented but missing/already-revoked
    // in storage implies it may have been stolen and already used — kill
    // the whole token family to end every related session.
    if (!stored || stored.revoked) {
      if (decoded.family) {
        await RefreshToken.updateMany({ family: decoded.family }, { revoked: true });
        console.warn(`[RefreshSecurity] Token reuse detected: family ${decoded.family} revoked.`);
      }
      return sendError(res, 403, "Session integrity issue detected. All related sessions were signed out.", { refreshToken: "token_reuse_detected" });
    }

    const user = await User.findById(decoded.userId).select("role tokenVersion isActive").lean();
    if (!user || user.isActive === false) {
      await RefreshToken.updateMany({ family: decoded.family }, { revoked: true });
      return sendError(res, 401, "Session owner is no longer authorized", { refreshToken: "invalid_user" });
    }

    stored.revoked = true;
    await stored.save();

    const pair = tokenManager.rotateRefreshToken(decoded.userId, user.role, decoded.family, user.tokenVersion || 0);

    await RefreshToken.create({
      tokenId: pair.refreshTokenId,
      family: pair.refreshTokenFamily,
      user: decoded.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    setAuthCookies(res, pair);
    return sendSuccess(res, 200, "Token refreshed successfully");
  } catch (error) {
    console.error("Refresh token error", error);
    return sendError(res, 500, "Token refresh failed", { refreshToken: "refresh_failed" });
  }
};

// ==========================================
// ADMIN USER MANAGEMENT
// ==========================================

const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;
    if (limit > 100) limit = 100;

    const users = await User.find({}).select("-password").limit(limit).skip((page - 1) * limit).sort({ createdAt: -1 });
    const total = await User.countDocuments();

    res.json({ success: true, users, total, pages: Math.ceil(total / limit), currentPage: page });
  } catch (error) {
    logger.error("Fetch users error:", error);
    return sendError(res, 500, "Something went wrong loading users. Please try again.", { users: "fetch_failed" });
  }
};

const PendingAction = require("../models/PendingAction");

// Promoting to Admin requires a second administrator's approval (not
// self-approvable) — this dual-authorization safeguard is independent of
// the login system and is kept as-is.
const promoteUser = async (req, res) => {
  try {
    const userToPromote = await User.findById(req.params.id);
    if (!userToPromote) return res.status(404).json({ message: "User not found" });

    if (userToPromote._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot promote your own account." });
    }
    if (userToPromote.role === "Super Admin" || userToPromote.role === "Admin") {
      return res.status(403).json({ message: "User is already an Admin or Super Admin" });
    }

    const { approvalId } = req.query;
    if (approvalId) {
      const approvedAction = await PendingAction.findById(approvalId);
      if (approvedAction && approvedAction.status === "APPROVED" && approvedAction.data.targetUserId === req.params.id) {
        if (approvedAction.approvals[0].adminId.toString() === req.user._id.toString()) {
          return res.status(403).json({ message: "You cannot approve your own promotion request." });
        }

        userToPromote.role = "Admin";
        await userToPromote.save();
        approvedAction.status = "EXECUTED";
        await approvedAction.save();
        correlationEngine.recordPromotion(userToPromote._id, userToPromote.email);

        await AuditLog.create({
          action: "User Promoted",
          performedBy: req.user.email,
          details: `${userToPromote.email} promoted to Admin (approved by a second administrator). Executed by ${req.user.email}.`,
          ip: req.ip || req.connection?.remoteAddress,
        });

        return res.json({ success: true, message: "User successfully promoted." });
      }
    }

    const pending = await PendingAction.create({
      actionType: "PROMOTE_USER",
      data: { targetUserId: userToPromote._id, targetEmail: userToPromote.email, requestedRole: "Admin" },
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: "Promotion Requested",
      performedBy: req.user.email,
      details: `Admin promotion requested for ${userToPromote.email}. Awaiting a second administrator's approval.`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.status(202).json({
      success: true,
      message: "This role change requires a second administrator's approval.",
      pendingActionId: pending._id,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error promoting user: " + error.message });
  }
};

const demoteUser = async (req, res) => {
  try {
    const userToDemote = await User.findById(req.params.id);
    if (!userToDemote) return res.status(404).json({ message: "User not found" });
    if (userToDemote.email === req.user.email) {
      return res.status(400).json({ message: "You cannot demote yourself" });
    }
    if (userToDemote.role === "Super Admin" && req.user.role !== "Super Admin") {
      return res.status(403).json({ message: "Only a Super Admin can demote a Super Admin" });
    }
    if (userToDemote.role === "Admin" && req.user.role !== "Super Admin") {
      return res.status(403).json({ message: "Only a Super Admin can demote an Admin" });
    }

    userToDemote.role = "Employee";
    await userToDemote.save();

    await AuditLog.create({
      action: "User Demoted",
      performedBy: req.user.email,
      details: `Demoted ${userToDemote.email} to Employee`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.json({ message: "User successfully demoted to Employee", user: { _id: userToDemote._id, email: userToDemote.email, role: userToDemote.role } });
  } catch (error) {
    res.status(500).json({ message: "Error demoting user" });
  }
};

const suspendUser = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.email === req.user.email) {
      return res.status(400).json({ message: "You cannot suspend yourself" });
    }
    if (user.role === "Super Admin" && req.user.role !== "Super Admin") {
      return res.status(403).json({ message: "Cannot suspend a Super Admin" });
    }

    user.isActive = isActive;
    await user.save();

    if (!isActive) {
      await RefreshToken.deleteMany({ user: user._id });
    }

    await AuditLog.create({
      action: isActive ? "Account Enabled" : "Account Suspended",
      performedBy: req.user.email,
      details: `${isActive ? "Enabled" : "Suspended"} account for ${user.email}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.json({ success: true, message: `User account successfully ${isActive ? "enabled" : "suspended"}` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating user status" });
  }
};

const adminResetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return sendError(res, 400, "Provide a new password", { newPassword: "required" });

    const passwordStrength = validatePasswordStrength(newPassword);
    if (!passwordStrength.isStrong) {
      return sendError(res, 400, "Password does not meet security requirements", { newPassword: passwordStrength.feedback.join(", ") });
    }

    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 400, "User not found", { id: "invalid_user" });
    if (user.role === "Super Admin" && req.user.role !== "Super Admin") {
      return sendError(res, 403, "Cannot reset password for a Super Admin", { role: "forbidden_target" });
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await AuditLog.create({
      action: "Admin Password Reset",
      performedBy: req.user.email,
      details: `Reset password for ${user.email}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    return sendSuccess(res, 200, "Password reset successfully");
  } catch (error) {
    return sendError(res, 500, "Error resetting password", { password: "reset_failed" });
  }
};

// Deleting a privileged (Admin/Super Admin) account requires a second
// administrator's approval; standard accounts delete immediately.
const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ message: "User not found" });

    if (userToDelete.email === req.user.email) {
      return res.status(400).json({ message: "Self-deletion is restricted." });
    }
    if ((userToDelete.role === "Super Admin" || userToDelete.role === "Admin") && req.user.role !== "Super Admin") {
      return res.status(403).json({ message: "Only a Super Admin can delete administrative accounts." });
    }

    const isPrivilegedTarget = ["Super Admin", "Admin"].includes(userToDelete.role);
    const { approvalId } = req.query;

    if (!isPrivilegedTarget) {
      await RefreshToken.deleteMany({ user: userToDelete._id });
      await userToDelete.deleteOne();

      await AuditLog.create({
        action: "User Deleted",
        performedBy: req.user.email,
        details: `Deleted user account ${userToDelete.email}`,
        ip: req.ip || req.connection?.remoteAddress,
      });

      if (req.app.get("io")) {
        req.app.get("io").emit("userDeleted", { userId: String(req.params.id), email: userToDelete.email });
      }

      return res.json({ success: true, message: "User account deleted successfully.", userId: String(req.params.id) });
    }

    if (approvalId) {
      const approvedAction = await PendingAction.findById(approvalId);
      if (approvedAction && approvedAction.status === "APPROVED" && approvedAction.data.targetUserId === req.params.id) {
        if (approvedAction.approvals[0].adminId.toString() === req.user._id.toString()) {
          return res.status(403).json({ message: "The approver cannot also be the one executing this deletion." });
        }

        await RefreshToken.deleteMany({ user: userToDelete._id });
        await userToDelete.deleteOne();
        approvedAction.status = "EXECUTED";
        await approvedAction.save();

        await AuditLog.create({
          action: "User Deleted",
          performedBy: req.user.email,
          details: `${userToDelete.email} permanently removed after a second administrator's approval.`,
          ip: req.ip || req.connection?.remoteAddress,
        });

        if (req.app.get("io")) {
          req.app.get("io").emit("userDeleted", { userId: String(req.params.id), email: userToDelete.email });
        }

        return res.json({ message: "User account successfully removed." });
      }
    }

    const pending = await PendingAction.create({
      actionType: "MASS_USER_DELETE",
      data: { targetUserId: userToDelete._id, targetEmail: userToDelete.email },
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: "Deletion Requested",
      performedBy: req.user.email,
      details: `Requested deletion of ${userToDelete.email}. Awaiting a second administrator's approval.`,
      ip: req.ip || req.connection?.remoteAddress,
    });

    return res.status(202).json({
      success: true,
      message: "Deleting an administrative account requires a second administrator's approval.",
      pendingActionId: pending._id,
    });
  } catch (error) {
    return sendError(res, 500, "Something went wrong deleting this account.", { user: "delete_failed" });
  }
};

const diagEmailTest = async (req, res) => {
  try {
    const to = String(req.query.to || process.env.ADMIN_EMAIL || req.user?.email || "").trim();
    if (!to) return sendError(res, 400, "Provide recipient via ?to=email@example.com", { to: "required" });

    const testUser = { _id: "test_67890", name: "Diagnostic Test", email: to, role: "User" };
    const hasSystemMail = (!!process.env.EMAIL_USER && !!process.env.EMAIL_PASS) || !!process.env.RESEND_API_KEY;
    const dispatch = await sendPasswordResetEmail(testUser, "diagnostic-token");

    return sendSuccess(res, 200, "Diagnostic email triggered.", {
      sentTo: to,
      provider: dispatch?.provider || "unknown",
      diag: { hasEmailUser: !!process.env.EMAIL_USER, hasEmailPass: !!process.env.EMAIL_PASS, hasResendKey: !!process.env.RESEND_API_KEY, envHealthy: hasSystemMail },
    });
  } catch (err) {
    return sendError(res, 500, "Diagnostic email dispatch failed", { email: "dispatch_failed" });
  }
};

const getUserActivity = async (req, res) => {
  try {
    const logs = await UserActivity.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20);
    return sendSuccess(res, 200, "Activity logs fetched successfully", { data: { logs } });
  } catch (err) {
    return sendError(res, 500, "Failed to fetch activity logs", { activity: "fetch_failed" });
  }
};

// ─────────────────────────────────────────────────────────────
// Password reset — uses a dedicated PasswordResetToken collection
// (hashed, single-use, time-limited) rather than a field on User.
// ─────────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const sanitizedEmail = sanitizeInput(email || "").toLowerCase();
    const genericResponse = { success: true, message: "If this email is registered, a password reset link has been sent." };

    if (!sanitizedEmail || !isValidEmail(sanitizedEmail)) {
      return res.status(200).json(genericResponse); // never reveal whether the email exists
    }

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const hasSystemMail = (!!process.env.EMAIL_USER && !!process.env.EMAIL_PASS) || !!process.env.RESEND_API_KEY;
    const isProduction = process.env.NODE_ENV === "production";

    if (!hasSystemMail) {
      if (isProduction) {
        return sendError(res, 500, "Email service is unavailable. Please try again later.", { email: "service_unavailable" });
      }

      const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
      const devResetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
      logger.warn(`[Auth] No email provider configured — dev-mode reset link for ${sanitizedEmail}: ${devResetUrl}`);
      console.log(`\n[DEV] Password reset link (no email service configured):\n${devResetUrl}\n`);

      return res.status(200).json({
        ...genericResponse,
        devOnly: {
          note: "No email provider is configured, so this link is returned directly instead of emailed. This only happens outside production.",
          resetUrl: devResetUrl,
        },
      });
    }

    await sendPasswordResetEmail(user, resetToken).catch((emailErr) => {
      logger.error(`[ForgotPassword] Email dispatch failed for ${sanitizedEmail}:`, emailErr.message);
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    logger.error("[Auth] Forgot password error:", error.message);
    return sendError(res, 500, "We could not process your request due to a server error. Please try again.", { email: "reset_failed" });
  }
};

const validateResetToken = async (req, res) => {
  try {
    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const record = await PasswordResetToken.findOne({ tokenHash, used: false, expiresAt: { $gt: new Date() } });
    if (!record) {
      return sendError(res, 400, "This reset link is invalid or has expired.", { token: "invalid_or_expired" });
    }
    return sendSuccess(res, 200, "Reset token is valid.");
  } catch (error) {
    return sendError(res, 500, "Unable to validate reset link.", { token: "validation_failed" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const passwordStrength = validatePasswordStrength(password || "");
    if (!passwordStrength.isStrong) {
      return sendError(res, 400, "Password does not meet security requirements", { password: passwordStrength.feedback.join(", ") });
    }

    const record = await PasswordResetToken.findOne({ tokenHash, used: false, expiresAt: { $gt: new Date() } }).populate("userId");
    if (!record || !record.userId) {
      return sendError(res, 400, "This reset link is invalid or has expired.", { token: "invalid_or_expired" });
    }

    const user = record.userId;
    user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    record.used = true;
    await record.save();

    await Promise.all([
      RefreshToken.deleteMany({ user: user._id }),
      AuditLog.create({ action: "PASSWORD_RESET", performedBy: user.email, details: "Password reset via emailed link.", ip: getClientIp(req) }),
    ]);

    return sendSuccess(res, 200, "Password reset successfully. Please sign in with your new password.");
  } catch (error) {
    logger.error("[Auth] Reset password error:", error.message);
    return sendError(res, 500, "We could not reset your password due to a server error. Please try again.", { password: "reset_failed" });
  }
};

// User-lifecycle workflow (deactivation + asset reassignment), independent
// of the login system.
const offboardUser = async (req, res) => {
  try {
    const userToOffboard = await User.findById(req.params.id);
    if (!userToOffboard) return sendError(res, 400, "User not found", { id: "invalid_user" });

    if (userToOffboard.email === req.user?.email) {
      return sendError(res, 400, "Self-offboarding is restricted for continuity", { user: "self_offboard_forbidden" });
    }
    if (["Super Admin", "Admin"].includes(userToOffboard.role) && req.user?.role !== "Super Admin") {
      return sendError(res, 403, "Only a Super Admin can offboard administrative accounts", { role: "insufficient_privilege" });
    }

    const reason = sanitizeInput(req.body?.reason || "Administrative offboard");

    userToOffboard.isActive = false;
    userToOffboard.offboardedAt = new Date();
    userToOffboard.offboardedBy = req.user?.email || "System";
    userToOffboard.offboardReason = reason;
    userToOffboard.tokenVersion = (userToOffboard.tokenVersion || 0) + 1;
    await userToOffboard.save();

    await RefreshToken.deleteMany({ user: userToOffboard._id });

    const assetUpdate = await Asset.updateMany(
      { assignedTo: userToOffboard.email },
      { $set: { status: "pending_recovery", assignedTo: null } },
    );
    const updatedCount = assetUpdate.modifiedCount || 0;

    await AuditLog.create({
      action: "USER_OFFBOARDED",
      performedBy: req.user?.email || "System",
      details: `Offboarded ${userToOffboard.email}. Assets moved to pending recovery: ${updatedCount}. Reason: ${reason}`,
      ip: req.ip || req.connection?.remoteAddress,
      resourceId: userToOffboard._id,
    });

    const io = req.app.get("io");
    if (io) io.emit("userOffboarded", { userId: String(userToOffboard._id), email: userToOffboard.email });

    return sendSuccess(res, 200, "User offboarded successfully. Assets marked for recovery.", { assetsUpdated: updatedCount });
  } catch (error) {
    return sendError(res, 500, "Offboarding failed", { user: "offboard_failed" });
  }
};

module.exports = {
  register,
  checkEmailAvailability,
  login,
  forgotPassword,
  validateResetToken,
  resetPassword,
  getMe,
  changePassword,
  updateProfile,
  logout,
  logoutAll,
  refresh,
  getAllUsers,
  promoteUser,
  demoteUser,
  suspendUser,
  adminResetPassword,
  deleteUser,
  offboardUser,
  diagEmailTest,
  getUserActivity,
};

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const RefreshToken = require("../models/RefreshToken");
const UserActivity = require("../models/UserActivity");
const TokenManager = require("../utils/tokenManager");
const UserSession = require("../models/UserSession");
const SecurityAlert = require("../models/SecurityAlert");
const { getGeoLocation } = require("../utils/geoIpService");
const riskScoringService = require("../services/riskScoringService");
const incidentResponseService = require("../services/incidentResponseService");
const qrcode = require("qrcode");
const {
  validatePasswordStrength,
  isValidEmail,
  RateLimiter,
  sanitizeInput,
} = require("../utils/security");
const geoip = require("geoip-lite");
const crypto = require("crypto");
const logger = require("../utils/logger");
const PasswordResetToken = require("../models/PasswordResetToken");
const {
  sendSecurityAlert,
  sendApprovalRequest,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  resend
} = require("../utils/emailService");
const correlationEngine = require("../services/correlationEngine");
const { extractClientIp } = require("../utils/clientIp");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const {
  TWO_FACTOR_ISSUER,
  TOTP_STEP_SECONDS,
  generateBackupCodes,
  generateEnrollmentSecret,
  verifyTotpToken,
  consumeBackupCode,
  registerTwoFactorFailure,
  resetTwoFactorFailures,
} = require("../services/twoFactorService");

// Token manager instance (uses env secrets)
const tokenManager = new TokenManager(process.env.JWT_SECRET, process.env.REFRESH_SECRET);

// Startup Sentinel: Verify critical production secrets on boot
if (!process.env.JWT_SECRET) console.error('[BOOT] FATAL: JWT_SECRET is missing!');
if (!process.env.DB_ENCRYPTION_SECRET) console.warn('[BOOT] WARNING: DB_ENCRYPTION_SECRET is not set â€” encrypted fields will use fallback. Existing data encrypted with a different key WILL fail to decrypt, causing login 500 errors.');

const getAccessCookieOptions = () => {
  const isDev = process.env.NODE_ENV === 'development';
  return {
    httpOnly: true,
    secure: !isDev,
    sameSite: !isDev ? 'none' : 'strict',
    maxAge: 15 * 60 * 1000,
    path: "/",
  };
};

const getRefreshCookieOptions = () => {
  const isDev = process.env.NODE_ENV === 'development';
  return {
    httpOnly: true,
    secure: !isDev,
    sameSite: !isDev ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth/refresh",
  };
};

const BCRYPT_ROUNDS = 12;
const APPROVAL_LINK_SECRET = process.env.APPROVAL_LINK_SECRET || process.env.JWT_SECRET;

const getClientIp = (req) => extractClientIp(req);

const verifyApprovalActionToken = (userId, token) =>
  jwt.verify(token, APPROVAL_LINK_SECRET, {
    algorithms: ["HS256"],
    issuer: "it-asset-tracker",
    audience: "admin-approval",
    subject: String(userId),
  });

const isValidBase32Secret = (secret) => {
  if (!secret || typeof secret !== "string") return false;
  const normalized = secret.trim().replace(/=+$/, "");
  return /^[A-Z2-7]+$/i.test(normalized) && normalized.length >= 16;
};

const createEmailVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
};

const setAuthCookies = (res, tokenPair) => {
  res.cookie("jwt", tokenPair.accessToken, getAccessCookieOptions());
  res.cookie("refreshToken", tokenPair.refreshToken, getRefreshCookieOptions());
};

const clearAuthCookies = (res) => {
  res.clearCookie("jwt", getAccessCookieOptions());
  res.clearCookie("refreshToken", getRefreshCookieOptions());
  res.clearCookie("token", getAccessCookieOptions());
};

const getRefreshTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.refreshToken;
  if (cookieToken) return cookieToken;
  return req.body?.refreshToken || null;
};

// Helper for professional activity logging (Â§Category 4)
const logUserActivity = async (userId, actionType, description, req) => {
  try {
    const ipAddress = getClientIp(req);
    const deviceInfo = {
      userAgent: req.get('User-Agent'),
      fingerprint: req.body.fingerprint || (req.headers && req.headers['x-agent-signature']) || 'unknown'
    };

    await UserActivity.create({
      userId,
      actionType,
      description,
      ipAddress,
      deviceInfo
    });
  } catch (err) {
    console.error("Failed to log user activity:", err.message);
  }
};


// Create rate limiters
const loginLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 mins
const registerLimiter = new RateLimiter(3, 60 * 60 * 1000); // 3 attempts per hour

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const ip = getClientIp(req);

    if (registerLimiter.isLimited(ip)) {
      return sendError(res, 403, "Too many registration attempts. Please try again later.", {
        auth: "rate_limited",
      });
    }

    if (!name || !email || !password) {
      return sendError(res, 400, "Please provide all required fields", {
        name: "required",
        email: "required",
        password: "required",
      });
    }

    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    if (!isValidEmail(sanitizedEmail)) {
      return sendError(res, 400, "Invalid email format", {
        email: "must_be_valid_email",
      });
    }

    const passwordStrength = validatePasswordStrength(password);
    if (!passwordStrength.isStrong) {
      return sendError(res, 400, "Password must contain uppercase, lowercase, number, and special character.", {
        password: passwordStrength.feedback.join(", "),
      });
    }

    const userExists = await User.findOne({ email: sanitizedEmail }).select("_id").lean();
    if (userExists) {
      return sendError(res, 400, "Email already registered", {
        email: "already_registered",
      });
    }

    if (sanitizedName.length < 3 || sanitizedName.length > 100) {
      return sendError(res, 400, "Full name must be between 3 and 100 characters", {
        name: "length_out_of_range",
      });
    }

    const hasUsers = await User.exists({});
    const assignedRole = hasUsers ? "Employee" : "Super Admin";
    const isApproved = !hasUsers;

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const emailVerification = createEmailVerificationToken();

    const user = await User.create({
      name: sanitizedName,
      email: sanitizedEmail,
      password: hashedPassword,
      role: assignedRole,
      createdAt: new Date(),
      lastLogin: null,
      isEmailVerified: false,
      emailVerificationToken: emailVerification.tokenHash,
      emailVerificationExpires: emailVerification.expiresAt,
      isApproved
    });

    setImmediate(() => {
      sendEmailVerificationEmail(user, emailVerification.rawToken).catch((emailErr) => {
        logger.error(`[Registration] Verification email failed for ${sanitizedEmail}:`, emailErr.message);
      });
    });

    if (!isApproved) {
      setImmediate(() => {
        sendApprovalRequest(user).catch((emailErr) => {
          logger.error(`[Registration] Background email failed for ${sanitizedEmail}:`, emailErr.message);
        });
      });
    }

    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role, user.tokenVersion);

    setImmediate(async () => {
      try {
        await Promise.all([
          AuditLog.create({
            action: "User Registered",
            performedBy: sanitizedEmail,
            details: isApproved ? `New user registered (Auto-approved): ${sanitizedName}` : `New user registration request: ${sanitizedName}`,
            ip,
            createdAt: new Date(),
          }),
          !isApproved ? Promise.resolve() : RefreshToken.create({
            tokenId: pair.refreshTokenId,
            family: pair.refreshTokenFamily,
            user: user._id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
          logUserActivity(user._id, "PROFILE_UPDATE", "Node Provisioned: Primary identity registration.", req)
        ]);
      } catch (logErr) {
        logger.error("Registration Logging Error:", logErr.message);
      }
    });

    if (!isApproved) {
      return res.status(201).json({
        success: true,
        message: "Registration successfully initialized. Compliance pending approval.",
      });
    }

    setAuthCookies(res, pair);

    return sendSuccess(res, 201, "Node Provisioned: Registration successful.", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        preferences: user.preferences,
        activityTimestamps: user.activityTimestamps,
      },
    });
  } catch (error) {
    logger.error("Registration Core Error:", error);
    return sendError(res, 500, "Strategic registration failure. Forensic log captured.", {
      registration: "unexpected_error",
    });
  }
};

const checkEmailAvailability = async (req, res) => {
  try {
    const email = sanitizeInput(req.body?.email || "").toLowerCase();
    if (!email || !isValidEmail(email)) {
      return sendError(res, 400, "Invalid email format", {
        email: "must_be_valid_email",
      });
    }

    const exists = await User.exists({ email });
    return res.status(200).json({
      success: true,
      available: !exists,
      message: exists ? "Email is already registered" : "Email is available"
    });
  } catch (error) {
    return sendError(res, 500, "Unable to validate email right now", {
      email: "validation_unavailable",
    });
  }
};

const login = async (req, res) => {
  try {
    const email = sanitizeInput(req.body?.email || "").toLowerCase();
    const password = req.body?.password;
    const fingerprint = req.body?.fingerprint;

    if (!email || !password) {
      return sendError(res, 400, "Email and password are required", {
        email: "required",
        password: "required",
      });
    }

    if (!isValidEmail(email)) {
      return sendError(res, 400, "Please provide a valid email address", {
        email: "must_be_valid_email",
      });
    }

    if (!process.env.DB_ENCRYPTION_SECRET) {
      return sendError(res, 500, "Strategic platform failure: Encryption services unavailable. Contact SOC security.", {
        encryption: "service_unavailable",
      });
    }

    const mongoose = require("mongoose");
    const rawDoc = await mongoose.connection.db
      .collection("users")
      .findOne({ email }, { projection: { password: 1, _id: 1 } });

    const user = rawDoc ? await User.findOne({ _id: rawDoc._id }).select("-password") : null;

    if (!rawDoc || !user || !rawDoc.password) {
      return sendError(res, 401, "Invalid email or password", {
        auth: "invalid_credentials",
      });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const waitMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return sendError(res, 403, `Account temporarily locked due to failed attempts. Try again in ${waitMinutes} minutes.`, {
        auth: "account_locked",
      });
    }

    if (user.isActive === false) {
      return sendError(res, 403, "Account is suspended.", {
        auth: "account_suspended",
      });
    }

    if (!user.isApproved && !["Super Admin", "Admin"].includes(user.role)) {
      return sendError(res, 403, "Your account is awaiting administrator approval.", {
        auth: "account_pending_approval",
      });
    }

    const isMatch = await bcrypt.compare(password, rawDoc.password);
    if (!isMatch) {
      const newFailCount = (user.failedLoginAttempts || 0) + 1;
      if (newFailCount >= 5) {
        await incidentResponseService.lockAccount(user._id, 15, "Multiple Failed Logins (Brute Force)");
      } else {
        await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: newFailCount } });
      }

      riskScoringService.evaluateUserRisk(user._id, newFailCount >= 5 ? "BRUTE_FORCE_ATTEMPT" : "FAILED_LOGIN");
      correlationEngine.checkBruteForce(getClientIp(req), email, {
        userAgent: req.headers["user-agent"] || "unknown",
        device: req.body?.fingerprint || "unknown"
      });

      return sendError(res, 401, "Invalid email or password", {
        auth: "invalid_credentials",
      });
    }

    const ip = getClientIp(req);
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
          metadata: {
            previousCountry: prevCountry,
            currentCountry: currCountry,
            previousIp: lastSession.ipAddress,
            currentUserAgent: userAgent
          }
        });
        riskScoringService.evaluateUserRisk(user._id, "NEW_COUNTRY_LOGIN");
      } else if (lastSession.ipAddress !== ip && lastSession.userAgent !== userAgent) {
        await correlationEngine.triggerAlert("SUSPICIOUS_IP", {
          severity: "HIGH",
          message: "Login from new device and network signature detected.",
          ip,
          userId: user._id,
          metadata: {
            previousIp: lastSession.ipAddress,
            previousUserAgent: lastSession.userAgent,
            currentUserAgent: userAgent
          }
        });
        riskScoringService.evaluateUserRisk(user._id, "NEW_DEVICE_LOGIN");
      }
    }

    await UserSession.create({
      userId: user._id,
      ipAddress: ip,
      userAgent,
      country: geoData.country,
      city: geoData.city
    });

    if (user.twoFactorEnabled) {
      if (!isValidBase32Secret(user.twoFactorSecret)) {
        return sendError(res, 500, "Two-Factor Authentication is misconfigured. Please contact your administrator.", {
          twoFactor: "secret_corrupt",
        });
      }

      return res.status(200).json({
        success: true,
        requires2FA: true,
        userId: user._id,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          name: user.name,
          twoFactorEnabled: true
        },
        message: "Two-factor authentication token required"
      });
    }

    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role, user.tokenVersion);

    setImmediate(async () => {
      try {
        const knownDevices = user.devices || [];
        const isNewDevice = !knownDevices.some((d) => d.ip === ip);

        await Promise.all([
          User.updateOne(
            { _id: user._id },
            {
              $set: {
                failedLoginAttempts: 0,
                lastLogin: new Date(),
                lastLoginIp: ip,
              },
              $unset: { lockUntil: "" }
            }
          ),
          RefreshToken.deleteMany({ user: user._id }),
          RefreshToken.create({
            tokenId: pair.refreshTokenId,
            family: pair.refreshTokenFamily,
            user: user._id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
          logUserActivity(user._id, "LOGIN", "Successful authentication.", req),
          correlationEngine.checkAnomalies(user._id, ip, {
            fingerprint: fingerprint || "unknown",
            isNewDevice
          })
        ]);

        if (isNewDevice && ["Super Admin", "Admin"].includes(user.role)) {
          correlationEngine.checkPrivilegeEscalation(user._id, ip, true);
        }
      } catch (postLoginErr) {
        console.error("Post-Login Update Error:", postLoginErr.message);
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
        twoFactorEnabled: user.twoFactorEnabled,
        isEmailVerified: user.isEmailVerified,
        preferences: user.preferences,
        activityTimestamps: user.activityTimestamps
      }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return sendError(res, 500, "Internal server error during login", {
      auth: "unexpected_error",
    });
  }
};

// @desc    Verify 2FA token during login (Step 2 of Split Flow)
// @route   POST /api/auth/verify-2fa
// @access  Public
const verify2FALogin = async (req, res) => {
  try {
    const { userId, token } = req.body;
    const ip = getClientIp(req);

    if (loginLimiter.isLimited(ip)) {
      return sendError(res, 403, "Too many attempts. Please try again later.", {
        auth: "rate_limited",
      });
    }

    if (!userId || !token) {
      return sendError(res, 400, "User ID and token are required", {
        userId: "required",
        token: "required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 401, "User not found", {
        userId: "invalid_user",
      });
    }

    if (user.twoFactorLockUntil && user.twoFactorLockUntil > Date.now()) {
      const waitMinutes = Math.ceil((user.twoFactorLockUntil - Date.now()) / 60000);
      return res.status(403).json({
        success: false,
        requires2FA: true,
        userId: user._id,
        message: `Two-factor authentication is temporarily locked. Try again in ${waitMinutes} minute(s).`,
        errors: { twoFactor: "locked" }
      });
    }

    if (!user.twoFactorEnabled) {
      return sendError(res, 400, "Two-factor authentication is not enabled for this account.", {
        twoFactor: "not_enabled",
      });
    }

    const rawSecret = user.twoFactorSecret;
    if (!isValidBase32Secret(rawSecret)) {
      console.error(`[2FA] CORRUPT SECRET for user ${userId}`);
      return sendError(res, 500, "Two-Factor Authentication is misconfigured. Please contact your administrator.", {
        twoFactor: "secret_corrupt",
      });
    }

    let isVerified = false;
    let usedBackupCode = false;
    try {
      isVerified = verifyTotpToken(rawSecret, token);
    } catch (totpErr) {
      console.error("[2FA] token verify error:", totpErr.message);
      return sendError(res, 500, "Verification error", {
        twoFactor: "verification_failed",
      });
    }

    if (!isVerified && user.twoFactorBackupCodes?.length > 0) {
      const recoveryResult = consumeBackupCode(user.twoFactorBackupCodes, token);
      if (recoveryResult.matched) {
        isVerified = true;
        usedBackupCode = true;
        user.twoFactorBackupCodes = recoveryResult.remainingCodes;
        user.markModified("twoFactorBackupCodes");
      }
    }

    if (!isVerified) {
      const failureState = registerTwoFactorFailure(user);
      await user.save();

      correlationEngine.checkBruteForce(ip, user.email, {
        userAgent: req.headers["user-agent"] || "unknown",
        device: req.body?.fingerprint || "unknown"
      });
      riskScoringService.evaluateUserRisk(user._id, "FAILED_LOGIN");
      await AuditLog.create({
        action: failureState.isLocked ? "2FA_LOGIN_LOCKED" : "2FA_LOGIN_FAILED",
        performedBy: user.email,
        details: failureState.isLocked
          ? `2FA locked after ${failureState.failures} failed attempts.`
          : `Invalid 2FA token attempt ${failureState.failures}/${5}.`,
        ip,
      });
      return res.status(401).json({
        success: false,
        requires2FA: true,
        userId: user._id,
        message: failureState.isLocked
          ? "Too many invalid 2FA attempts. Two-factor authentication has been temporarily locked."
          : "Invalid 2FA token. Please try again.",
        errors: { twoFactor: failureState.isLocked ? "locked" : "invalid_token" }
      });
    }

    resetTwoFactorFailures(user);
    await user.save();

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
          metadata: {
            previousCountry: prevCountry,
            currentCountry: currCountry,
            previousIp: lastSession.ipAddress,
            currentUserAgent: userAgent
          }
        });
      } else if (lastSession.ipAddress !== ip && lastSession.userAgent !== userAgent) {
        await correlationEngine.triggerAlert("SUSPICIOUS_IP", {
          severity: "HIGH",
          message: "Login from new device and network signature detected.",
          ip,
          userId: user._id,
          metadata: {
            previousIp: lastSession.ipAddress,
            previousUserAgent: lastSession.userAgent,
            currentUserAgent: userAgent
          }
        });
      }
    }

    await UserSession.create({
      userId: user._id,
      ipAddress: ip,
      userAgent,
      country: geoData.country,
      city: geoData.city
    });

    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role, user.tokenVersion);

    setImmediate(async () => {
      try {
        await Promise.all([
          User.updateOne(
            { _id: user._id },
            {
              $set: {
                failedLoginAttempts: 0,
                lastLogin: new Date(),
                lastLoginIp: ip,
              },
              $unset: { lockUntil: "" }
            }
          ),
          RefreshToken.deleteMany({ user: user._id }),
          RefreshToken.create({
            tokenId: pair.refreshTokenId,
            family: pair.refreshTokenFamily,
            user: user._id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
          logUserActivity(user._id, "LOGIN", "Successful 2FA authentication.", req),
          AuditLog.create({
            action: usedBackupCode ? "2FA_BACKUP_CODE_USED" : "2FA_LOGIN_SUCCESS",
            performedBy: user.email,
            details: usedBackupCode
              ? "Two-factor challenge completed using a single-use backup code."
              : "Two-factor challenge completed successfully.",
            ip,
          }),
          correlationEngine.checkAnomalies(user._id, ip, {
            fingerprint: req.body?.fingerprint || "unknown",
            isNewDevice: true
          })
        ]);
      } catch (err) {
        console.error("2FA Post-Login Update Error:", err.message);
      }
    });

    setAuthCookies(res, pair);

    return sendSuccess(res, 200, "Two-factor verification successful", {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        twoFactorEnabled: true,
        isEmailVerified: user.isEmailVerified,
        preferences: user.preferences,
        activityTimestamps: user.activityTimestamps
      }
    });
  } catch (err) {
    console.error("2FA VERIFY ERR:", err);
    return sendError(res, 500, "Unable to verify two-factor code.", {
      twoFactor: "verification_failed",
    });
  }
};


// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    // Optimized: Fetch only required metadata for session state
    const user = await User.findById(req.user._id)
      .select("name email role preferences activityTimestamps twoFactorEnabled phone department location")
      .lean(); // Use lean() for faster read-only access (Â§Performance)

    if (!user) return res.status(404).json({ success: false, message: "User registry entry not found." });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Please provide current and new password" });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.isStrong) {
      return res.status(400).json({
        success: false,
        message: "Password does not meet security requirements",
        feedback: strength.feedback,
        score: strength.score
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "New password must be different from current password" });
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    if (!user.activityTimestamps) user.activityTimestamps = {};
    user.activityTimestamps.passwordChangedAt = Date.now();
    user.markModified("activityTimestamps");

    await user.save();

    await Promise.all([
      RefreshToken.deleteMany({ user: user._id }),
      logUserActivity(user._id, "PASSWORD_CHANGE", "User changed their password", req),
      AuditLog.create({
        action: "PASSWORD_CHANGED",
        performedBy: user.email,
        details: "Password changed and active sessions invalidated.",
        ip: getClientIp(req),
      })
    ]);

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to change password" });
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, preferences, phone, department } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (phone) user.phone = phone; // Assuming field exists or we add it
    if (department) user.department = department;

    if (preferences) {
      user.preferences = {
        ...(user.preferences || {}),
        ...preferences
      };
      user.markModified("preferences");
    }

    if (!user.activityTimestamps) user.activityTimestamps = {};
    user.activityTimestamps.profileUpdatedAt = Date.now();
    user.markModified("activityTimestamps");

    await user.save();
    await logUserActivity(user._id, "PROFILE_UPDATE", "User updated their profile information", req);

    res.json({ success: true, user, message: "Profile updated successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Logout current session
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      const verified = tokenManager.verifyRefreshToken(refreshToken);
      if (verified.valid) {
        await RefreshToken.updateOne(
          {
            tokenId: verified.decoded.tokenId,
            family: verified.decoded.family,
            user: verified.decoded.userId,
          },
          { revoked: true }
        );
      }
    }

    clearAuthCookies(res);

    // Attempt to log if user is present but don't crash
    if (req.user && req.user._id) {
      await logUserActivity(req.user._id, "LOGOUT", "User logged out successfully.", req).catch(() => { });
    }

    return sendSuccess(res, 200, "Logout successful");
  } catch (err) {
    console.error("Logout Error:", err);
    return sendError(res, 500, "Logout processing error", { auth: "logout_failed" });
  }
};

// @desc    Logout from all sessions
// @route   POST /api/auth/logout-all
// @access  Private
const logoutAll = async (req, res) => {
  try {
    // Revoke all refresh tokens for this user
    await RefreshToken.updateMany({ user: req.user._id }, { revoked: true });

    clearAuthCookies(res);

    // Log audit
    await AuditLog.create({
      action: 'Logout All',
      performedBy: req.user.email || req.user._id,
      details: 'User logged out from all sessions',
      ip: req.ip || req.connection.remoteAddress,
    });

    return sendSuccess(res, 200, "Logged out from all sessions successfully");
  } catch (error) {
    return sendError(res, 500, "Failed to log out from all sessions", { auth: "logout_all_failed" });
  }
};

// @desc Refresh access token using refresh token
// @route POST /api/auth/refresh
// @access Public (requires valid refresh token)
const refresh = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) return sendError(res, 400, "Refresh token required", { refreshToken: "required" });

    const verified = tokenManager.verifyRefreshToken(refreshToken);
    if (!verified.valid) return sendError(res, 401, "Invalid refresh token", { refreshToken: "invalid" });

    const decoded = verified.decoded;

    // Check stored refresh token record
    const stored = await RefreshToken.findOne({ tokenId: decoded.tokenId, family: decoded.family, user: decoded.userId });

    // SECURITY: Token Reuse Detection (Â§8.4)
    // If a valid JWT refresh token is presented but not found in DB or already revoked,
    // it implies it might have been stolen and used already. 
    // We revoke the entire family to kill all related sessions.
    if (!stored || stored.revoked) {
      if (decoded.family) {
        await RefreshToken.updateMany({ family: decoded.family }, { revoked: true });
        console.warn(`[RefreshSecurity] TOKEN REUSE DETECTED: Family ${decoded.family} revoked.`);
      }
      return sendError(res, 403, "Security Alert: Session integrity compromise detected. All related sessions revoked.", { refreshToken: "token_reuse_detected" });
    }

    // Rotate: revoke old token and issue new pair with same family
    stored.revoked = true;
    await stored.save();

    const pair = tokenManager.rotateRefreshToken(decoded.userId, decoded.role, decoded.family);

    await RefreshToken.create({
      tokenId: pair.refreshTokenId,
      family: pair.refreshTokenFamily,
      user: decoded.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    setAuthCookies(res, pair);

    return sendSuccess(res, 200, "Token refreshed successfully");
  } catch (error) {
    console.error('Refresh token error', error);
    return sendError(res, 500, "Token refresh failed", {
      refreshToken: "refresh_failed",
    });
  }
};

// @desc    Generate 2FA secret
// @route   POST /api/auth/2fa/generate
// @access  Private
const generate2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const secret = generateEnrollmentSecret(user.email);

    user.twoFactorSecret = secret.base32;
    user.twoFactorEnabled = false;
    user.twoFactorBackupCodes = [];
    user.failedTwoFactorAttempts = 0;
    user.twoFactorLockUntil = undefined;
    await user.save();
    await AuditLog.create({
      action: "2FA_SECRET_GENERATED",
      performedBy: user.email,
      details: "A new TOTP enrollment secret was generated for the user.",
      ip: getClientIp(req),
    });

    const dataUrl = await qrcode.toDataURL(secret.otpauthUrl);
    return res.json({
      success: true,
      secret: secret.base32,
      qrCode: dataUrl,
      issuer: TWO_FACTOR_ISSUER,
      algorithm: "SHA1",
      digits: 6,
      period: TOTP_STEP_SECONDS,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error generating 2FA secret" });
  }
};

// @desc    Verify and Enable 2FA
// @route   POST /api/auth/2fa/verify
// @access  Private
const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: "Generate a 2FA secret before verification." });
    }

    const isVerified = verifyTotpToken(user.twoFactorSecret, token);

    if (isVerified) {
      user.twoFactorEnabled = true;
      const backupCodes = generateBackupCodes();
      user.twoFactorBackupCodes = backupCodes;
      resetTwoFactorFailures(user);

      if (!user.activityTimestamps) user.activityTimestamps = {};
      user.activityTimestamps.tfaEnabledAt = Date.now();
      user.markModified("activityTimestamps");
      await user.save();
      await logUserActivity(user._id, "2FA_ENABLE", "User enabled Two-Factor Authentication", req);
      await AuditLog.create({
        action: "2FA_ENABLED",
        performedBy: user.email,
        details: "Two-factor authentication enabled and backup codes generated.",
        ip: getClientIp(req),
      });

      res.json({
        success: true,
        message: "Two-Factor authentication successfully enabled",
        backupCodes,
        serverTime: new Date().toISOString(),
      });
    } else {
      res.status(400).json({ success: false, message: "Invalid authentication code" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Error verifying 2FA" });
  }
};

// @desc    Disable 2FA
// @route   POST /api/auth/2fa/disable
// @access  Private
const disable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    resetTwoFactorFailures(user);
    if (!user.activityTimestamps) user.activityTimestamps = {};
    user.activityTimestamps.tfaEnabledAt = undefined;
    user.activityTimestamps.tfaDisabledAt = Date.now();
    user.markModified("activityTimestamps");
    await user.save();
    await logUserActivity(user._id, "2FA_DISABLE", "User disabled Two-Factor Authentication", req);
    await AuditLog.create({
      action: "2FA_DISABLED",
      performedBy: user.email,
      details: "Two-factor authentication disabled after step-up authentication.",
      ip: getClientIp(req),
    });

    res.json({ success: true, message: "Two-Factor authentication disabled" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error disabling 2FA" });
  }
};

const regenerate2FARecoveryCodes = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: "Two-Factor authentication must be enabled before rotating recovery codes." });
    }

    const backupCodes = generateBackupCodes();
    user.twoFactorBackupCodes = backupCodes;
    if (!user.activityTimestamps) user.activityTimestamps = {};
    user.activityTimestamps.tfaRecoveryCodesRotatedAt = Date.now();
    user.markModified("activityTimestamps");
    await user.save();

    await logUserActivity(user._id, "2FA_ENABLE", "User rotated 2FA recovery codes", req);
    await AuditLog.create({
      action: "2FA_RECOVERY_CODES_ROTATED",
      performedBy: user.email,
      details: "User regenerated single-use 2FA recovery codes.",
      ip: getClientIp(req),
    });

    return res.json({
      success: true,
      message: "Recovery codes regenerated successfully",
      backupCodes,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error rotating recovery codes" });
  }
};

// ==========================================
// ADMIN USER MANAGEMENT
// ==========================================

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;
    if (limit > 100) limit = 100; // Security Cap

    const users = await User.find({})
      .select("-password")
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    res.json({
      success: true,
      users,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    logger.error("IAM Fetch Registry Error:", error);
    return sendError(res, 500, "Strategic Error: Failed to synchronize identity registry.", { users: "fetch_failed" });
  }
};


const PendingAction = require("../models/PendingAction");

// @desc    Promote user to Admin (Now requires Dual-Auth Â§3.1)
// @route   PUT /api/auth/users/:id/promote
// @access  Private/Admin
const promoteUser = async (req, res) => {
  try {
    const userToPromote = await User.findById(req.params.id);
    if (!userToPromote) return res.status(404).json({ message: "User not found" });

    // Privilege Abuse Detection (Â§5.3)
    if (userToPromote._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: "Security Violation: Self-elevation is forbidden (Â§5.3)." });
    }

    if (userToPromote.role === "Super Admin" || userToPromote.role === "Admin") {
      return res.status(403).json({ message: "User is already an Admin or Super Admin" });
    }

    const { approvalId } = req.query; // Check if Approval token is provided (Â§3.1)

    if (approvalId) {
      // SECOND ADMIN APPROVER LOGIC
      const approvedAction = await PendingAction.findById(approvalId);
      if (approvedAction && approvedAction.status === "APPROVED" && approvedAction.data.targetUserId === req.params.id) {

        // Verify it was approved by someone ELSE (Â§3.1)
        if (approvedAction.approvals[0].adminId.toString() === req.user._id.toString()) {
          return res.status(403).json({ message: "4-Eyes Principle: You cannot approve your own promotion request." });
        }

        userToPromote.role = "Admin";
        await userToPromote.save();

        approvedAction.status = "EXECUTED";
        await approvedAction.save();

        await AuditLog.create({
          action: "DUAL-AUTH: User Promoted",
          performedBy: req.user.email,
          details: `Admin role GAINED by ${userToPromote.email} via Dual Authorization. Executed by ${req.user.email}.`,
          ip: req.ip || req.connection?.remoteAddress
        });

        return res.json({ success: true, message: "Action Executed: User successfully promoted via Dual Authorization." });
      }
    }

    // If no approved action exists, create a pending one (Â§3.1)
    const pending = await PendingAction.create({
      actionType: "PROMOTE_USER",
      data: { targetUserId: userToPromote._id, targetEmail: userToPromote.email, requestedRole: "Admin" },
      createdBy: req.user._id
    });

    await AuditLog.create({
      action: "SECURITY: Promotion Requested",
      performedBy: req.user.email,
      details: `Admin promotion requested for ${userToPromote.email}. Penting 4-Eyes approval.`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.status(202).json({
      success: true,
      message: "Dual Authorization Required: This critical role change requires a second administrator's approval.",
      pendingActionId: pending._id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error in promotion procedure: " + error.message });
  }
};

// @desc    Demote Admin to Standard User (Admin only)
// @route   PUT /api/auth/users/:id/demote
// @access  Private/Admin
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

// @desc    Suspend/Enable user account (Admin only)
// @route   PUT /api/auth/users/:id/suspend
// @access  Private/Admin
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

    // If suspended, invalidate all refresh tokens
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

// @desc    Admin Reset User Password (Admin only)
// @route   PUT /api/auth/users/:id/reset-password
// @access  Private/Admin
const adminResetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return sendError(res, 400, "Provide a new password", {
        newPassword: "required",
      });
    }

    const passwordStrength = validatePasswordStrength(newPassword);
    if (!passwordStrength.isStrong) {
      return sendError(res, 400, "Password does not meet security requirements", {
        newPassword: passwordStrength.feedback.join(", "),
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 400, "User not found", { id: "invalid_user" });
    if (user.role === "Super Admin" && req.user.role !== "Super Admin") {
      return sendError(res, 403, "Cannot reset password for a Super Admin", {
        role: "forbidden_target",
      });
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all active JWT sessions
    await user.save();

    await AuditLog.create({
      action: "Admin Password Reset",
      performedBy: req.user.email,
      details: `Reset password for ${user.email}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    return sendSuccess(res, 200, "Password reset successfully");
  } catch (error) {
    return sendError(res, 500, "Error resetting password", {
      password: "reset_failed",
    });
  }
};

// @desc    Admin Disable 2FA for User (Admin only)
// @route   PUT /api/auth/users/:id/disable-2fa
// @access  Private/Admin
const adminDisable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 400, "User not found", { id: "invalid_user" });

    if (user.role === "Super Admin" && req.user.role !== "Super Admin") {
      return sendError(res, 403, "Cannot disable 2FA for a Super Admin", {
        role: "forbidden_target",
      });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save();

    await AuditLog.create({
      action: "Admin 2FA Disabled",
      performedBy: req.user.email,
      details: `Disabled 2FA for ${user.email}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    return sendSuccess(res, 200, "2FA successfully disabled for the user");
  } catch (error) {
    return sendError(res, 500, "Error disabling 2FA", {
      twoFactor: "disable_failed",
    });
  }
};

// @desc    Delete user account (Now requires Dual-Auth Â§3.1)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ message: "User not found" });

    // Self-elevation / Abuse check (Â§5.3)
    if (userToDelete.email === req.user.email) {
      return res.status(400).json({ message: "Self-deletion is restricted for continuity and forensics." });
    }

    // Role-based protection: Standard admin cannot delete Super Admin/Admin without Dual-Auth
    if (userToDelete.role === "Super Admin" || userToDelete.role === "Admin") {
      if (req.user.role !== "Super Admin") {
        return res.status(403).json({ message: "Security Violation: Only a Super Admin can initiate deletion of administrative accounts." });
      }
    }

    const isPrivilegedTarget = ["Super Admin", "Admin"].includes(userToDelete.role);
    const { approvalId } = req.query; // Check for Dual-Auth approval (Â§3.1)

    // Immediate delete for standard users to keep IAM table/state consistent.
    if (!isPrivilegedTarget) {
      await RefreshToken.deleteMany({ user: userToDelete._id });
      await userToDelete.deleteOne();

      await AuditLog.create({
        action: "User Deleted",
        performedBy: req.user.email,
        details: `Deleted user account ${userToDelete.email}`,
        ip: req.ip || req.connection?.remoteAddress
      });

      if (req.app.get("io")) {
        req.app.get("io").emit("userDeleted", { userId: String(req.params.id), email: userToDelete.email });
      }

      return res.json({ success: true, message: "User account deleted successfully.", userId: String(req.params.id) });
    }

    if (approvalId) {
      const approvedAction = await PendingAction.findById(approvalId);
      if (approvedAction && approvedAction.status === "APPROVED" && approvedAction.data.targetUserId === req.params.id) {

        // 4-Eyes Check: Approver must be DIFFERENT from the final executor
        if (approvedAction.approvals[0].adminId.toString() === req.user._id.toString()) {
          return res.status(403).json({ message: "Security Violation: Executioner cannot be the same as the Approver (Â§3.1)." });
        }

        // Invalidate sessions and delete
        await RefreshToken.deleteMany({ user: userToDelete._id });
        await userToDelete.deleteOne();

        approvedAction.status = "EXECUTED";
        await approvedAction.save();

        await AuditLog.create({
          action: "DUAL-AUTH: User Deleted",
          performedBy: req.user.email,
          details: `User account ${userToDelete.email} permanently removed after Dual Authorization. Action requested by UserID: ${approvedAction.createdBy}`,
          ip: req.ip || req.connection?.remoteAddress
        });

        if (req.app.get("io")) {
          req.app.get("io").emit("userDeleted", { userId: String(req.params.id), email: userToDelete.email });
        }

        return res.json({ message: "User account successfully removed through Dual Authorization process." });
      }
    }

    // Otherwise, create a pending request (Â§3.1)
    const pending = await PendingAction.create({
      actionType: "MASS_USER_DELETE",
      data: { targetUserId: userToDelete._id, targetEmail: userToDelete.email },
      createdBy: req.user._id
    });

    await AuditLog.create({
      action: "SECURITY: Deletion Requested",
      performedBy: req.user.email,
      details: `Requested deletion of user account: ${userToDelete.email}. Pending secondary admin consent.`,
      ip: req.ip || req.connection?.remoteAddress,
    });

    return res.status(202).json({
      success: true,
      message: "Dual Authorization Required: Secondary administrator must verify this account deletion (§3.1).",
      pendingActionId: pending._id
    });
  } catch (error) {
    return sendError(res, 500, "High-assurance deletion system error.", { user: "delete_failed" });
  }
};

// @desc    Approve user account
// @route   GET /api/auth/approve/:id
// @access  Public (via secure link in email)
const approveUser = async (req, res) => {
  try {
    const approvalPayload = verifyApprovalActionToken(req.params.id, req.params.token);
    if (approvalPayload.action !== "approve") {
      return sendError(res, 403, "Invalid approval link", {
        token: "invalid_or_expired",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 400, "User not found", { id: "invalid_user" });

    if (user.isApproved) {
      return sendSuccess(res, 200, "This user account has already been approved.");
    }

    user.isApproved = true;
    await user.save();

    await AuditLog.create({
      action: "Account Approved",
      performedBy: "Core Admin (Email Link)",
      details: `Approved account for ${user.email}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    return sendSuccess(res, 200, "Account approved successfully", {
      data: { email: user.email }
    });
  } catch (error) {
    return sendError(res, 403, "Invalid approval link", {
      token: "invalid_or_expired",
    });
  }
};

// @desc    Reject user account
// @route   GET /api/auth/reject/:id
// @access  Public (via secure link in email)
const rejectUser = async (req, res) => {
  try {
    const approvalPayload = verifyApprovalActionToken(req.params.id, req.params.token);
    if (approvalPayload.action !== "reject") {
      return sendError(res, 403, "Invalid approval link", {
        token: "invalid_or_expired",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 400, "User not found", { id: "invalid_user" });

    const userEmail = user.email;
    await User.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: "Account Rejected",
      performedBy: "Core Admin (Email Link)",
      details: `Rejected and deleted account request for ${userEmail}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    return sendSuccess(res, 200, "Account request rejected successfully", {
      data: { email: userEmail }
    });
  } catch (error) {
    return sendError(res, 403, "Invalid approval link", {
      token: "invalid_or_expired",
    });
  }
};

const diagEmailTest = async (req, res) => {
  try {
    const to = String(req.query.to || process.env.ADMIN_EMAIL || req.user?.email || "").trim();
    if (!to) {
      return sendError(res, 400, "Provide recipient via ?to=email@example.com", {
        to: "required",
      });
    }

    const testUser = {
      _id: "test_67890",
      name: "Dummy Test User",
      email: to,
      role: "User"
    };
    const adminEmail = to;
    const hasSystemMail = (!!process.env.EMAIL_USER && !!process.env.EMAIL_PASS) || !!process.env.RESEND_API_KEY;

    const dispatch = await sendPasswordResetEmail(testUser, "diagnostic-token");
    return sendSuccess(res, 200, "Diagnostic reset email triggered!", {
      sentTo: adminEmail,
      provider: dispatch?.provider || "unknown",
      diag: {
        hasEmailUser: !!process.env.EMAIL_USER,
        hasEmailPass: !!process.env.EMAIL_PASS,
        hasResendKey: !!process.env.RESEND_API_KEY,
        resendClientInitialized: !!resend,
        envHealthy: hasSystemMail
      }
    });
  } catch (err) {
    return sendError(res, 500, "Diagnostic email dispatch failed", {
      email: "dispatch_failed",
    });
  }
};

// @desc    Get user's activity logs
// @route   GET /api/auth/activity
// @access  Private
const getUserActivity = async (req, res) => {
  try {
    const logs = await UserActivity.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    return sendSuccess(res, 200, "Activity logs fetched successfully", {
      data: { logs }
    });
  } catch (err) {
    return sendError(res, 500, "Failed to fetch activity logs", {
      activity: "fetch_failed",
    });
  }
};

/**
 * @desc    Verify email ownership
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
const verifyEmail = async (req, res) => {
  try {
    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return sendError(res, 400, "Email verification link is invalid or expired.", {
        token: "invalid_or_expired",
      });
    }

    if (user.isEmailVerified) {
      return sendSuccess(res, 200, "Email address has already been verified.");
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    await AuditLog.create({
      action: "EMAIL_VERIFIED",
      performedBy: user.email,
      details: `Email ownership verified for ${user.email}`,
      ip: getClientIp(req),
    });

    return sendSuccess(res, 200, "Email verified successfully.", {
      data: { email: user.email }
    });
  } catch (error) {
    logger.error("[Auth] Email verification error:", error.message);
    return sendError(res, 500, "Email verification failed", {
      token: "verification_failed",
    });
  }
};

/**
 * @desc    Forgot Password - Initiative secure reset workflow
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email || !isValidEmail(email)) {
      return sendError(res, 400, "Invalid email format", {
        email: "must_be_valid_email",
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const genericResponse = {
      success: true,
      message: "If an account exists for this email address, a password reset link has been sent."
    };

    const user = await User.findOne({ email: sanitizedEmail })
      .select("_id email name")
      .lean();

    if (!user) {
      logger.warn(`[Auth] Forgot password requested for non-existing email: ${sanitizedEmail}`);
      return res.status(200).json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    const resetRecord = await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    const hasSystemMail = (!!process.env.EMAIL_USER && !!process.env.EMAIL_PASS) || !!process.env.RESEND_API_KEY;
    if (!hasSystemMail) {
      await PasswordResetToken.deleteOne({ _id: resetRecord._id });
      return sendError(res, 500, "Email service is unavailable. Please try again later.", {
        email: "service_unavailable",
      });
    }

    let dispatchMeta = null;
    try {
      dispatchMeta = await sendPasswordResetEmail(user, resetToken);
      logger.info(`[Auth] Reset email dispatched to ${user.email} via ${dispatchMeta?.provider || "unknown-provider"}`);
    } catch (emailErr) {
      logger.error(`[Auth] Reset email dispatch failed for ${user.email}: ${emailErr.message}`);
      await PasswordResetToken.deleteOne({ _id: resetRecord._id });
      return sendError(res, 500, "Failed to send reset link. Please try again in a few minutes.", {
        email: "dispatch_failed",
      });
    }

    setImmediate(async () => {
      try {
        await AuditLog.create({
          action: "RECOVERY_LINK_DISPATCHED",
          performedBy: user.email,
          details: `Password reset link sent to ${user.email}${dispatchMeta?.provider ? ` via ${dispatchMeta.provider}` : ""}`,
          ip: getClientIp(req),
        });
      } catch (logErr) {
        logger.error("Background Log Error:", logErr.message);
      }
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    logger.error("[Auth] Forgot password error:", error.message);
    return sendError(res, 500, "Internal server error", {
      email: "forgot_password_failed",
    });
  }
};

/**
 * @desc    Validate Reset Token - Verify token integrity before UI reveal
 * @route   GET /api/auth/reset-password/:token
 * @access  Public
 */
const validateResetToken = async (req, res) => {
  try {
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const resetTokenRecord = await PasswordResetToken.findOne({
      tokenHash: hashedToken,
      expiresAt: { $gt: Date.now() },
      used: false
    }).populate("userId");

    if (!resetTokenRecord || !resetTokenRecord.userId) {
      return sendError(res, 400, "Reset link is invalid or expired.", {
        token: "invalid_or_expired",
      });
    }

    return res.json({
      success: true,
      data: {
        valid: true,
        email: resetTokenRecord.userId.email
      }
    });
  } catch (error) {
    logger.error("[Auth] Token validation error:", error.message);
    return sendError(res, 500, "Token validation internal error.", {
      token: "validation_failed",
    });
  }
};

/**
 * @desc    Reset Password - Commit new credentials
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return sendError(res, 400, "New password is required", {
        password: "required",
      });
    }

    const strength = validatePasswordStrength(password);
    if (!strength.isStrong) {
      return sendError(res, 400, "Password does not meet security requirements", {
        password: strength.feedback.join(", "),
      });
    }

    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const resetTokenRecord = await PasswordResetToken.findOne({
      tokenHash,
      expiresAt: { $gt: Date.now() },
      used: false
    }).populate("userId");

    if (!resetTokenRecord || !resetTokenRecord.userId) {
      return sendError(res, 400, "Reset link is invalid or expired.", {
        token: "invalid_or_expired",
      });
    }

    const user = resetTokenRecord.userId;

    user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    resetTokenRecord.used = true;

    await Promise.all([
      user.save(),
      resetTokenRecord.save(),
      RefreshToken.deleteMany({ user: user._id }),
      AuditLog.create({
        action: "PASSWORD_RESET_SUCCESS",
        performedBy: user.email,
        details: "Password reset completed. Sessions revoked.",
        ip: getClientIp(req),
      }),
      logUserActivity(user._id, "SECURITY", "Password successfully reset via recovery link.", req)
    ]);

    return res.json({ success: true, message: "Credentials updated successfully. Please sign in." });
  } catch (error) {
    logger.error("[Auth] Reset Commit Failure:", error.message);
    return sendError(res, 500, "Credential rotation system failure.", {
      password: "reset_failed",
    });
  }
};

/**
 * @desc    Admin-Direct Approval (Dashboard)
 * @route   PUT /api/auth/users/:id/approve
 * @access  Private/Admin
 */
const approveUserByAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 400, "Identity not found in registry.", { id: "invalid_user" });

    if (user.isApproved) {
      return sendError(res, 400, "This account is already in a compliant approved state.", { user: "already_approved" });
    }

    user.isApproved = true;
    await user.save();

    await AuditLog.create({
      action: "SECURITY: Identity Approved",
      performedBy: req.user.email,
      details: `Manually approved account for ${user.email} via IAM Dashboard.`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.json({ success: true, message: `Account for ${user.email} has been white-listed and approved.` });
  } catch (error) {
    console.error("IAM Approval Error:", error);
    return sendError(res, 500, "Strategic Error: Failed to commit approval state.", { user: "approval_failed" });
  }
};

module.exports = {
  register,
  checkEmailAvailability,
  login,
  verifyEmail,
  forgotPassword,
  validateResetToken,
  resetPassword,
  getMe,
  changePassword,
  updateProfile,
  logout,
  logoutAll,
  refresh,
  generate2FA,
  verify2FA,
  disable2FA,
  regenerate2FARecoveryCodes,
  getAllUsers,
  promoteUser,
  demoteUser,
  suspendUser,
  adminResetPassword,
  adminDisable2FA,
  deleteUser,
  approveUser,
  rejectUser,
  approveUserByAdmin,
  diagEmailTest,
  getUserActivity,
  verify2FALogin
};













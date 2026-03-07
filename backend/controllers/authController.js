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
const speakeasy = require("speakeasy");
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
const { sendSecurityAlert, sendApprovalRequest, sendPasswordResetEmail } = require("../utils/emailService");
const correlationEngine = require("../services/correlationEngine");

// Token manager instance (uses env secrets)
const tokenManager = new TokenManager(process.env.JWT_SECRET, process.env.REFRESH_SECRET);

// Startup Sentinel: Verify critical production secrets on boot
if (!process.env.JWT_SECRET) console.error('[BOOT] FATAL: JWT_SECRET is missing!');
if (!process.env.DB_ENCRYPTION_SECRET) console.warn('[BOOT] WARNING: DB_ENCRYPTION_SECRET is not set — encrypted fields will use fallback. Existing data encrypted with a different key WILL fail to decrypt, causing login 500 errors.');

const getCookieOptions = () => {
  // Default to secure production settings unless explicitly in local development
  const isDev = process.env.NODE_ENV === 'development';
  return {
    httpOnly: true,
    secure: !isDev,
    sameSite: !isDev ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
};

// Helper for professional activity logging (§Category 4)
const logUserActivity = async (userId, actionType, description, req) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
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
    const { name, email, password } = req.body; // role is NEVER accepted from client
    console.log("Password received:", password);
    const ip = req.ip || req.connection.remoteAddress;

    // Rate limiting
    if (registerLimiter.isLimited(ip)) {
      return res.status(429).json({
        message: "Too many registration attempts. Please try again later.",
      });
    }

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    // Validate email format
    if (!isValidEmail(sanitizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate password strength
    const passwordStrength = validatePasswordStrength(password);
    if (!passwordStrength.isStrong) {
      return res.status(400).json({
        success: false,
        message: "Password must contain uppercase, lowercase, number, and special character.",
        feedback: passwordStrength.feedback,
        score: passwordStrength.score,
      });
    }

    // Check if user exists - Optimized Read
    const userExists = await User.findOne({ email: sanitizedEmail }).select("_id").lean();
    if (userExists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Validate name length
    if (sanitizedName.length < 2 || sanitizedName.length > 100) {
      return res.status(400).json({ message: "Name must be between 2 and 100 characters" });
    }

    // PRIVILEGE ESCALATION PREVENTION
    const hasUsers = await User.exists({}); // Lightweight check
    let assignedRole = "Employee";
    let isApproved = false;

    if (!hasUsers) {
      assignedRole = "Super Admin";
      isApproved = true;
    }

    // Manually hash password since we removed the pre-save hook
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name: sanitizedName,
      email: sanitizedEmail,
      password: hashedPassword,
      role: assignedRole,
      createdAt: new Date(),
      lastLogin: null,
      isEmailVerified: false,
      isApproved: isApproved
    });

    // Send approval request (NON-BLOCKING)
    if (!isApproved) {
      setImmediate(() => {
        sendApprovalRequest(user).catch(emailErr => {
          logger.error(`[Registration] Background email failed for ${sanitizedEmail}:`, emailErr.message);
        });
      });
    }

    // Parallelize tasks
    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role, user.tokenVersion);

    // NON-BLOCKING Security Logging for faster registration response
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
        message: "Registration successfully initialized. Compliance pending approval.",
      });
    }

    res.cookie('jwt', pair.accessToken, getCookieOptions());

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      preferences: user.preferences,
      activityTimestamps: user.activityTimestamps,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      message: "Node Provisioned: Registration successful.",
    });
  } catch (error) {
    logger.error("Registration Core Error:", error);
    res.status(500).json({ message: "Strategic registration failure. Forensic log captured." });
  }
};


const login = async (req, res) => {
  try {
    console.log("=== LOGIN ATTEMPT ===");
    const { email } = req.body;
    const pwd = req.body.password;
    const { token2FA, fingerprint } = req.body;

    // 1️⃣ Validate input
    if (!email || !pwd) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
        code: "AUTH_400"
      });
    }

    if (!process.env.JWT_SECRET) console.error("JWT_SECRET missing");

    // Get Raw Document (for raw password)
    const mongoose = require('mongoose');
    const rawDoc = await mongoose.connection.db
      .collection('users')
      .findOne(
        { email: email.toLowerCase().trim() },
        { projection: { password: 1, _id: 1 } }
      );

    // 2️⃣ Find user by email
    const user = rawDoc ? await User.findOne({ _id: rawDoc._id }).select('-password') : null;

    if (!rawDoc || !user || !rawDoc.password) {
      console.log("Login failed: User not found or missing password hash");
      return res.status(401).json({ success: false, message: "Invalid credentials", code: "AUTH_401" });
    }

    // 3️⃣ Check if account is locked or disabled
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const waitMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(403).json({ success: false, message: `Account temporarily locked due to failed attempts. Try again in ${waitMinutes} minutes.`, code: "AUTH_403" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "Identity Decommissioned: Access is permanently suspended.", code: "AUTH_403" });
    }

    if (!user.isApproved && !["Super Admin", "Admin"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Compliance Pending: Your account is awaiting administrator approval. Please contact a SOC manager.",
        code: "ACCOUNT_PENDING_APPROVAL"
      });
    }

    // 4️⃣ Validate password using bcrypt.compare
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(pwd, rawDoc.password);
    } catch (bcryptErr) {
      console.error('[Login] bcrypt error:', bcryptErr.message);
    }

    if (!isMatch) {
      console.log("Login failed: Incorrect password");
      const newFailCount = (user.failedLoginAttempts || 0) + 1;
      const updateFields = { failedLoginAttempts: newFailCount };
      if (newFailCount >= 5) {
        await incidentResponseService.lockAccount(user._id, 15, "Multiple Failed Logins (Brute Force)");
      } else {
        await User.updateOne({ _id: user._id }, { $set: updateFields });
      }

      // Risk Scoring Integration
      riskScoringService.evaluateUserRisk(user._id, newFailCount >= 5 ? "BRUTE_FORCE_ATTEMPT" : "FAILED_LOGIN");

      // Correlation Engine: Brute force detection
      correlationEngine.checkBruteForce(req.ip || req.connection?.remoteAddress, email);

      return res.status(401).json({ success: false, message: "Invalid credentials", code: "AUTH_401" });
    }

    // 5️⃣ If password correct: Reset failedAttempts (handled below before token issue)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const geoData = await getGeoLocation(ip);

    // Smart SOC Anomaly Detection
    const lastSession = await UserSession.findOne({ userId: user._id }).sort({ loginTime: -1 });
    if (lastSession) {
      if (lastSession.country !== "Unknown" && geoData.country !== "Unknown" && lastSession.country !== geoData.country) {
        await SecurityAlert.create({
          type: "AI_FLAGGED_ANOMALY",
          severity: "CRITICAL",
          message: `Impossible Travel: Login from ${geoData.country} but last login was ${lastSession.country}`,
          details: `User teleported across borders. Last IP: ${lastSession.ipAddress}, Current IP: ${ip}`,
          userId: user._id,
          sourceIp: ip
        });
        riskScoringService.evaluateUserRisk(user._id, "NEW_COUNTRY_LOGIN");
        await incidentResponseService.terminateAllSessions(user._id, "Impossible Travel (Geo-velocity violation)");
      } else if (lastSession.ipAddress !== ip && lastSession.userAgent !== userAgent) {
        await SecurityAlert.create({
          type: "SUSPICIOUS_IP",
          severity: "HIGH",
          message: `Suspicious Login: New Device and IP Address detected.`,
          details: `Prev IP: ${lastSession.ipAddress}, New IP: ${ip}. Agent changed from [${lastSession.userAgent}] to [${userAgent}].`,
          userId: user._id,
          sourceIp: ip
        });
        riskScoringService.evaluateUserRisk(user._id, "NEW_DEVICE_LOGIN");
        await incidentResponseService.terminateAllSessions(user._id, "Suspicious Device and IP Signature Shift");
      }
    }

    // Persist current session telematic data
    await UserSession.create({
      userId: user._id,
      ipAddress: ip,
      userAgent,
      country: geoData.country,
      city: geoData.city
    });

    // 6️⃣ If 2FA enabled:
    console.log("User 2FA status:", user.twoFactorEnabled);
    if (user.twoFactorEnabled) {
      // Split 2FA flow: If 2FA is enabled, we return 200 with a specific flag
      // so the frontend knows to show the OTP screen.
      // We use 200 instead of 401 to avoid unintended global catchers/interceptors.
      console.log(`[2FA] User ${user._id} requires 2FA. Prompting frontend.`);
      return res.status(200).json({
        success: true,
        requires2FA: true,
        userId: user._id,
        twoFactorEnabled: true,
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

    // 7️⃣ Generate JWT & System Updates
    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role, user.tokenVersion);
    const failedAttemptsBefore = user.failedLoginAttempts || 0;

    // NON-BLOCKING: Parallelize system updates and security engine checks
    setImmediate(async () => {
      try {
        const ioInst = req.app.get('io');
        const knownDevices = user.devices || [];
        const isNewDevice = !knownDevices.some(d => d.ip === ip);

        await Promise.all([
          User.updateOne(
            { _id: user._id },
            {
              $set: {
                failedLoginAttempts: 0,
                lastLogin: new Date(),
                lastLoginIp: ip,
              },
              $unset: { lockUntil: '' }
            }
          ),
          RefreshToken.deleteMany({ user: user._id }),
          RefreshToken.create({
            tokenId: pair.refreshTokenId,
            family: pair.refreshTokenFamily,
            user: user._id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
          logUserActivity(user._id, "LOGIN", "Successful authentication.", req)
        ]);

        // Feature 1 & 3: Autonomous Threat Detection & Behavior Monitoring
        await correlationEngine.checkAnomalies(user._id, ip, {
          fingerprint: req.body.fingerprint || 'unknown',
          isNewDevice
        });

        // Feature 4: Zero Trust - Check if this should be a high-risk escalation
        if (isNewDevice && ["Super Admin", "Admin"].includes(user.role)) {
          correlationEngine.checkPrivilegeEscalation(user._id, ip, true);
        }
      } catch (postLoginErr) {
        console.error("Post-Login Update Error:", postLoginErr.message);
      }
    });

    res.clearCookie('token');
    res.clearCookie('jwt');
    res.cookie('jwt', pair.accessToken, getCookieOptions());

    // 8️⃣ Return success response
    return res.json({
      success: true,
      token: pair.accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        twoFactorEnabled: user.twoFactorEnabled,
        preferences: user.preferences,
        activityTimestamps: user.activityTimestamps
      },
      timestamp: new Date().toISOString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
};

// @desc    Verify 2FA token during login (Step 2 of Split Flow)
// @route   POST /api/auth/verify-2fa
// @access  Public
const verify2FALogin = async (req, res) => {
  try {
    const { userId, token } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || req.ip || 'unknown';

    // 1️⃣ Rate Limiting
    if (loginLimiter.isLimited(ip)) {
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Please try again later.",
        code: "AUTH_429"
      });
    }

    if (!userId || !token) {
      return res.status(400).json({ success: false, message: "User ID and token are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Guard: detect corrupt/unencrypted/missing secret
    const rawSecret = user.twoFactorSecret;
    if (!rawSecret || rawSecret.trim().length < 10) {
      console.error(`[2FA] CORRUPT SECRET for user ${userId}`);
      return res.status(500).json({
        success: false,
        message: "Two-Factor Authentication is misconfigured. Please contact your administrator.",
        code: "2FA_SECRET_CORRUPT"
      });
    }

    let isVerified = false;
    try {
      isVerified = speakeasy.totp.verify({
        secret: rawSecret,
        encoding: 'base32',
        token: token.trim(),
        window: 2 // Increased window for better drift tolerance
      });
    } catch (totpErr) {
      console.error('[2FA] speakeasy.totp.verify error:', totpErr.message);
      return res.status(500).json({ success: false, message: "Verification error" });
    }

    // Check backup codes
    if (!isVerified && user.twoFactorBackupCodes?.length > 0) {
      const matchedCode = user.twoFactorBackupCodes.find(code => code === token.trim());
      if (matchedCode) {
        isVerified = true;
        await User.updateOne({ _id: user._id }, { $pull: { twoFactorBackupCodes: matchedCode } });
      }
    }

    if (!isVerified) {
      correlationEngine.checkBruteForce(ip, user.email); // Track 2FA brute force attempts
      riskScoringService.evaluateUserRisk(user._id, "FAILED_LOGIN");
      return res.status(401).json({
        success: false,
        message: "Invalid 2FA token. Please try again.",
        code: "2FA_INVALID"
      });
    }

    const userAgent = req.headers['user-agent'] || 'unknown';
    const geoData = await getGeoLocation(ip);

    // Smart SOC Anomaly Detection
    const lastSession = await UserSession.findOne({ userId: user._id }).sort({ loginTime: -1 });
    if (lastSession) {
      if (lastSession.country !== "Unknown" && geoData.country !== "Unknown" && lastSession.country !== geoData.country) {
        await SecurityAlert.create({
          type: "AI_FLAGGED_ANOMALY",
          severity: "CRITICAL",
          message: `Impossible Travel: Login from ${geoData.country} but last login was ${lastSession.country}`,
          details: `User teleported across borders. Last IP: ${lastSession.ipAddress}, Current IP: ${ip}`,
          userId: user._id,
          sourceIp: ip
        });
        riskScoringService.evaluateUserRisk(user._id, "NEW_COUNTRY_LOGIN");
        await incidentResponseService.terminateAllSessions(user._id, "Impossible Travel (Geo-velocity violation)");
      } else if (lastSession.ipAddress !== ip && lastSession.userAgent !== userAgent) {
        await SecurityAlert.create({
          type: "SUSPICIOUS_IP",
          severity: "HIGH",
          message: `Suspicious Login: New Device and IP Address detected.`,
          details: `Prev IP: ${lastSession.ipAddress}, New IP: ${ip}. Agent changed from [${lastSession.userAgent}] to [${userAgent}].`,
          userId: user._id,
          sourceIp: ip
        });
        riskScoringService.evaluateUserRisk(user._id, "NEW_DEVICE_LOGIN");
        await incidentResponseService.terminateAllSessions(user._id, "Suspicious Device and IP Signature Shift");
      }
    }

    // Persist current session telematic data
    await UserSession.create({
      userId: user._id,
      ipAddress: ip,
      userAgent,
      country: geoData.country,
      city: geoData.city
    });

    // 7️⃣ Generate JWT & System Updates
    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role, user.tokenVersion);

    // NON-BLOCKING: Parallelize system updates and logging
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
              $unset: { lockUntil: '' }
            }
          ),
          RefreshToken.deleteMany({ user: user._id }),
          RefreshToken.create({
            tokenId: pair.refreshTokenId,
            family: pair.refreshTokenFamily,
            user: user._id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
          logUserActivity(user._id, "LOGIN", "Successful 2FA authentication.", req)
        ]);
      } catch (err) {
        console.error("2FA Post-Login Update Error:", err.message);
      }
    });

    res.cookie('jwt', pair.accessToken, getCookieOptions());

    return res.json({
      success: true,
      token: pair.accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        twoFactorEnabled: true,
        preferences: user.preferences,
        activityTimestamps: user.activityTimestamps
      },
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: true,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    });

  } catch (err) {
    console.error("2FA VERIFY ERR:", err);
    res.status(500).json({ success: false, message: err.message });
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
      .lean(); // Use lean() for faster read-only access (§Performance)

    if (!user) return res.status(404).json({ message: "User registry entry not found." });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Please provide current and new password" });
    }

    const user = await User.findById(req.user._id);

    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all active JWT sessions

    if (!user.activityTimestamps) user.activityTimestamps = {};
    user.activityTimestamps.passwordChangedAt = Date.now();
    user.markModified("activityTimestamps");
    await user.save();

    await logUserActivity(user._id, "PASSWORD_CHANGE", "User changed their password", req);


    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout current session
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    const opts = getCookieOptions();
    // Aggressively clear both possible token names and bypass the timeout issue
    res.clearCookie('jwt', opts);
    res.clearCookie('token', opts);

    // Attempt to log if user is present but don't crash
    if (req.user && req.user._id) {
      await logUserActivity(req.user._id, "LOGOUT", "User logged out successfully.", req).catch(() => { });
    }

    res.status(200).json({ success: true, message: "Logout successful" });
  } catch (err) {
    console.error("Logout Error:", err);
    res.status(500).json({ success: false, message: "Logout processing error" });
  }
};

// @desc    Logout from all sessions
// @route   POST /api/auth/logout-all
// @access  Private
const logoutAll = async (req, res) => {
  try {
    // Revoke all refresh tokens for this user
    await RefreshToken.updateMany({ user: req.user._id }, { revoked: true });

    const opts = getCookieOptions();
    res.cookie('jwt', '', { ...opts, maxAge: 0, expires: new Date(0) });

    // Log audit
    await AuditLog.create({
      action: 'Logout All',
      performedBy: req.user.email || req.user._id,
      details: 'User logged out from all sessions',
      ip: req.ip || req.connection.remoteAddress,
    });

    res.json({ message: "Logged out from all sessions successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Refresh access token using refresh token
// @route POST /api/auth/refresh
// @access Public (requires valid refresh token)
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });

    const verified = tokenManager.verifyRefreshToken(refreshToken);
    if (!verified.valid) return res.status(401).json({ message: 'Invalid refresh token' });

    const decoded = verified.decoded;

    // Check stored refresh token record
    const stored = await RefreshToken.findOne({ tokenId: decoded.tokenId, family: decoded.family, user: decoded.userId || decoded.userId });
    if (!stored || stored.revoked) {
      return res.status(401).json({ message: 'Refresh token revoked or not found' });
    }

    // Rotate: revoke old token and issue new pair with same family
    stored.revoked = true;
    await stored.save();

    const pair = tokenManager.rotateRefreshToken(decoded.userId || decoded.user, decoded.role, decoded.family);

    await RefreshToken.create({
      tokenId: pair.refreshTokenId,
      family: pair.refreshTokenFamily,
      user: decoded.userId || decoded.user,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie('jwt', pair.accessToken, getCookieOptions());

    return res.json({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
  } catch (error) {
    console.error('Refresh token error', error);
    return res.status(500).json({ message: 'Token refresh failed' });
  }
};

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @desc    Generate 2FA secret
// @route   POST /api/auth/2fa/generate
// @access  Private
const generate2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const secret = speakeasy.generateSecret({
      name: `AssetTracker (${user.email})`
    });

    user.twoFactorSecret = secret.base32;
    await user.save();

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) throw err;
      res.json({ secret: secret.base32, qrCode: data_url });
    });
  } catch (error) {
    res.status(500).json({ message: "Error generating 2FA secret" });
  }
};

// @desc    Verify and Enable 2FA
// @route   POST /api/auth/2fa/verify
// @access  Private
const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id);

    const isVerified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (isVerified) {
      user.twoFactorEnabled = true;
      // Generate 10 random hex backup codes
      const crypto = require('crypto');
      const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex'));
      user.twoFactorBackupCodes = backupCodes;

      if (!user.activityTimestamps) user.activityTimestamps = {};
      user.activityTimestamps.tfaEnabledAt = Date.now();
      user.markModified("activityTimestamps");
      await user.save();
      await logUserActivity(user._id, "2FA_ENABLE", "User enabled Two-Factor Authentication", req);

      res.json({ message: "Two-Factor authentication successfully enabled", backupCodes });
    } else {
      res.status(400).json({ message: "Invalid authentication code" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error verifying 2FA" });
  }
};

// @desc    Disable 2FA
// @route   POST /api/auth/2fa/disable
// @access  Private
const disable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    if (!user.activityTimestamps) user.activityTimestamps = {};
    user.activityTimestamps.tfaEnabledAt = undefined;
    user.markModified("activityTimestamps");
    await user.save();
    await logUserActivity(user._id, "2FA_DISABLE", "User disabled Two-Factor Authentication", req);


    res.json({ message: "Two-Factor authentication disabled" });
  } catch (error) {
    res.status(500).json({ message: "Error disabling 2FA" });
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
      users,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    logger.error("IAM Fetch Registry Error:", error);
    res.status(500).json({ message: "Strategic Error: Failed to synchronize identity registry." });
  }
};


const PendingAction = require("../models/PendingAction");

// @desc    Promote user to Admin (Now requires Dual-Auth §3.1)
// @route   PUT /api/auth/users/:id/promote
// @access  Private/Admin
const promoteUser = async (req, res) => {
  try {
    const userToPromote = await User.findById(req.params.id);
    if (!userToPromote) return res.status(404).json({ message: "User not found" });

    // Privilege Abuse Detection (§5.3)
    if (userToPromote._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: "Security Violation: Self-elevation is forbidden (§5.3)." });
    }

    if (userToPromote.role === "Super Admin" || userToPromote.role === "Admin") {
      return res.status(403).json({ message: "User is already an Admin or Super Admin" });
    }

    const { approvalId } = req.query; // Check if Approval token is provided (§3.1)

    if (approvalId) {
      // SECOND ADMIN APPROVER LOGIC
      const approvedAction = await PendingAction.findById(approvalId);
      if (approvedAction && approvedAction.status === "APPROVED" && approvedAction.data.targetUserId === req.params.id) {

        // Verify it was approved by someone ELSE (§3.1)
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

        return res.json({ message: "Action Executed: User successfully promoted via Dual Authorization." });
      }
    }

    // If no approved action exists, create a pending one (§3.1)
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
      message: "Dual Authorization Required: This critical role change requires a second administrator's approval.",
      pendingActionId: pending._id
    });
  } catch (error) {
    res.status(500).json({ message: "Error in promotion procedure: " + error.message });
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

    res.json({ message: `User account successfully ${isActive ? "enabled" : "suspended"}` });
  } catch (error) {
    res.status(500).json({ message: "Error updating user status" });
  }
};

// @desc    Admin Reset User Password (Admin only)
// @route   PUT /api/auth/users/:id/reset-password
// @access  Private/Admin
const adminResetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: "Provide a new password" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "Super Admin" && req.user.role !== "Super Admin") {
      return res.status(403).json({ message: "Cannot reset password for a Super Admin" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all active JWT sessions
    await user.save();

    await AuditLog.create({
      action: "Admin Password Reset",
      performedBy: req.user.email,
      details: `Reset password for ${user.email}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error resetting password" });
  }
};

// @desc    Admin Disable 2FA for User (Admin only)
// @route   PUT /api/auth/users/:id/disable-2fa
// @access  Private/Admin
const adminDisable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "Super Admin" && req.user.role !== "Super Admin") {
      return res.status(403).json({ message: "Cannot disable 2FA for a Super Admin" });
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

    res.json({ message: "2FA successfully disabled for the user" });
  } catch (error) {
    res.status(500).json({ message: "Error disabling 2FA" });
  }
};

// @desc    Delete user account (Now requires Dual-Auth §3.1)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ message: "User not found" });

    // Self-elevation / Abuse check (§5.3)
    if (userToDelete.email === req.user.email) {
      return res.status(400).json({ message: "Self-deletion is restricted for continuity and forensics." });
    }

    // Role-based protection: Standard admin cannot delete Super Admin/Admin without Dual-Auth
    if (userToDelete.role === "Super Admin" || userToDelete.role === "Admin") {
      if (req.user.role !== "Super Admin") {
        return res.status(403).json({ message: "Security Violation: Only a Super Admin can initiate deletion of administrative accounts." });
      }
    }

    const { approvalId } = req.query; // Check for Dual-Auth approval (§3.1)

    if (approvalId) {
      const approvedAction = await PendingAction.findById(approvalId);
      if (approvedAction && approvedAction.status === "APPROVED" && approvedAction.data.targetUserId === req.params.id) {

        // 4-Eyes Check: Approver must be DIFFERENT from the final executor
        if (approvedAction.approvals[0].adminId.toString() === req.user._id.toString()) {
          return res.status(403).json({ message: "Security Violation: Executioner cannot be the same as the Approver (§3.1)." });
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

        return res.json({ message: "User account successfully removed through Dual Authorization process." });
      }
    }

    // Otherwise, create a pending request (§3.1)
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

    res.status(202).json({
      message: "Dual Authorization Required: Secondary administrator must verify this account deletion (§3.1).",
      pendingActionId: pending._id
    });
  } catch (error) {
    res.status(500).json({ message: "High-assurance deletion system error: " + error.message });
  }
};

// @desc    Approve user account
// @route   GET /api/auth/approve/:id
// @access  Public (via secure link in email)
const approveUser = async (req, res) => {
  try {
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send("<h1>Invalid ID</h1><p>The provided ID is not a valid user identifier.</p>");
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send("<h1>User Not Found</h1><p>The user you are trying to approve does not exist.</p>");

    if (user.isApproved) {
      return res.send("<h1>Already Approved</h1><p>This user account has already been approved.</p>");
    }

    user.isApproved = true;
    await user.save();

    await AuditLog.create({
      action: "Account Approved",
      performedBy: "Core Admin (Email Link)",
      details: `Approved account for ${user.email}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.send(`
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #28a745;">Success!</h1>
        <p>Account for <strong>${user.email}</strong> has been successfully approved.</p>
        <p>The user can now log in to the system.</p>
      </div>
    `);
  } catch (error) {
    res.status(500).send("<h1>Error</h1><p>An error occurred while approving the user.</p>");
  }
};

// @desc    Reject user account
// @route   GET /api/auth/reject/:id
// @access  Public (via secure link in email)
const rejectUser = async (req, res) => {
  try {
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send("<h1>Invalid ID</h1><p>The provided ID is not a valid user identifier.</p>");
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send("<h1>User Not Found</h1><p>The user you are trying to reject does not exist.</p>");

    const userEmail = user.email;
    await User.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: "Account Rejected",
      performedBy: "Core Admin (Email Link)",
      details: `Rejected and deleted account request for ${userEmail}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.send(`
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #dc3545;">Account Rejected</h1>
        <p>The account request for <strong>${userEmail}</strong> has been rejected and the record has been removed.</p>
      </div>
    `);
  } catch (error) {
    res.status(500).send("<h1>Error</h1><p>An error occurred while rejecting the user.</p>");
  }
};

const diagEmailTest = async (req, res) => {
  try {
    const testUser = {
      _id: "test_67890",
      name: "Dummy Test User",
      email: "dummy@test.com",
      role: "User"
    };
    const adminEmail = process.env.ADMIN_EMAIL || 'ragulp.career@gmail.com';
    const hasSystemMail = (!!process.env.EMAIL_USER && !!process.env.EMAIL_PASS) || !!process.env.RESEND_API_KEY;

    await sendApprovalRequest(testUser);
    res.json({
      success: true,
      message: "Approval request email triggered!",
      sentTo: adminEmail.replace(/(.{2}).*(@.*)/, "$1...$2"),
      diag: {
        hasEmailUser: !!process.env.EMAIL_USER,
        hasEmailPass: !!process.env.EMAIL_PASS,
        hasResendKey: !!process.env.RESEND_API_KEY,
        envHealthy: hasSystemMail
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
};

/**
 * @desc    Forgot Password - Initiative secure reset workflow
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  const startTime = Date.now();
  const { email } = req.body;

  try {
    // 1. INPUT VALIDATION (Strategic §1.1)
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "Formal registry error: Invalid email format." });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    // 2. DB HEALTH CHECK (Requirement 1 - Diagnostic)
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
      logger.error("[Auth] FATAL: Database not connected. Readiness State: " + mongoose.connection.readyState);
      return res.status(503).json({ message: "Security Engine temporarily offline (DB Connection Failure)." });
    }

    // 3. OPTIMIZED USER LOOKUP (Requirement 3 - Performance)
    // We only need the ID to generate the token
    const user = await User.findOne({ email: sanitizedEmail, isActive: true })
      .select("_id email name")
      .lean();

    // 4. ANTI-ENUMERATION RESPONSE (§1.2 - Guard against discovery attacks)
    const genericResponse = {
      message: "If an account exists for this email address, a password reset link has been sent.",
      latency: `${Date.now() - startTime}ms`
    };

    // If user doesn't exist, exit early but return standard success message
    if (!user) {
      logger.info(`[Auth] Recovery attempted for unregistered node: ${sanitizedEmail}`);
      return res.status(200).json({
        ...genericResponse,
        meta: { userStatus: 'unidentified', diagnostic: 'abort-early' }
      });
    }

    // 5. SECURE TOKEN GENERATION (§Step 3)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // 6. PERSISTENCE (Requirement 3)
    const resetRecord = await PasswordResetToken.create({
      userId: user._id,
      tokenHash: hashedToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    // 7. PRODUCTION INCIDENT RESPONSE: Synchronous Email Dispatch
    // As per Requirement 1: Do NOT allow silent success.
    // We wait for the email to ensure delivery before returning 200.
    try {
      // PROD DIAGNOSTIC: Check for required env vars before attempting dispatch
      const hasSystemMail = (!!process.env.EMAIL_USER && !!process.env.EMAIL_PASS) || !!process.env.RESEND_API_KEY;

      if (!hasSystemMail) {
        console.error(`[Auth] FATAL: Email service not configured on host. EMAIL_USER=${!!process.env.EMAIL_USER}, RESEND=${!!process.env.RESEND_API_KEY}`);
        // Cleanup token since we can't send it
        await PasswordResetToken.deleteOne({ _id: resetRecord._id });

        return res.status(503).json({
          message: "Email dispatch service is currently offline. Please contact an administrator.",
          code: "EMAIL_SERVICE_MISSING"
        });
      }

      console.log(`[Auth] Initiating synchronous email dispatch to: ${user.email}`);
      const emailResult = await sendPasswordResetEmail(user, resetToken);
      console.log(`[Auth] Email sent successfully. ID: ${emailResult?.messageId || 'Resend API ID'}`);

      // Strategic Audit Logging (Background)
      setImmediate(async () => {
        try {
          await AuditLog.create({
            action: "RECOVERY_LINK_DISPATCHED",
            performedBy: user.email,
            details: `Secure reset link transmitted to ${user.email} via ${emailResult?.provider || 'unknown'}.`,
            ip: req.ip || req.connection?.remoteAddress,
          });
        } catch (logErr) { logger.error("Background Log Error:", logErr.message); }
      });

      return res.status(200).json({
        ...genericResponse,
        meta: {
          provider: emailResult?.provider,
          userStatus: 'identified',
          diagnostic: 'handshake-complete'
        }
      });

    } catch (emailErr) {
      console.error(`[Auth] EXPLICIT RESET FAILURE for ${user.email}:`, emailErr.message);

      // CLEANUP: Delete the token if it couldn't be sent
      await PasswordResetToken.deleteOne({ _id: resetRecord._id });

      return res.status(503).json({
        message: "Network Error: Failed to transmit recovery link. Please try again in 5 minutes.",
        meta: { userStatus: 'identified', error: emailErr.message },
        code: "EMAIL_DISPATCH_FAILURE"
      });
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Auth] CRITICAL SYSTEM FAULT (Latency: ${totalTime}ms):`, error);

    // REQUIREMENT: Must return JSON so frontend doesn't see "Bad Gateway" or "CORS Block"
    return res.status(500).json({
      message: "Internal Security Engine Failure.",
      debug: error.message,
      meta: { userStatus: 'unknown', diagnostic: 'abort-unhandled' }
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
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const resetTokenRecord = await PasswordResetToken.findOne({
      tokenHash: hashedToken,
      expiresAt: { $gt: Date.now() },
      used: false
    }).populate("userId");

    if (!resetTokenRecord || !resetTokenRecord.userId) {
      return res.status(400).json({ message: "Reset signature invalid or identity link expired." });
    }

    res.json({ valid: true, email: resetTokenRecord.userId.email });
  } catch (error) {
    logger.error("[Auth] Token validation error:", error.message);
    res.status(500).json({ message: "Token validation internal error." });
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

    // 1. Cryptographic validation of the specific token
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const resetTokenRecord = await PasswordResetToken.findOne({
      tokenHash: hashedToken,
      expiresAt: { $gt: Date.now() },
      used: false
    }).populate("userId");

    if (!resetTokenRecord || !resetTokenRecord.userId) {
      return res.status(400).json({ message: "Strategic Reset Failure: Link has expired or was already rotated." });
    }

    const user = resetTokenRecord.userId;

    // 2. Security Check: Block weak passwords (§Step 4)
    if (password.length < 12) {
      return res.status(400).json({ message: "Password must be at least 12 characters long for security compliance." });
    }

    // 3. Commit new credentials
    // The User model's pre-save hook was removed. Hash manually.
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all active JWT sessions
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // 4. Mark token as used and commit password change atomically.
    resetTokenRecord.used = true;
    await Promise.all([
      user.save(),
      resetTokenRecord.save(),
      RefreshToken.deleteMany({ user: user._id }), // Revoke all sessions (§Step 4)
      AuditLog.create({
        action: "PASSWORD_RESET_SUCCESS",
        performedBy: user.email,
        details: `Account credentials successfully rotated. All sessions invalidated.`,
        ip: req.ip || req.connection?.remoteAddress,
      }),
      logUserActivity(user._id, "SECURITY", "Password successfully reset via recovery link.", req)
    ]);

    logger.info(`[Auth] Password successfully rotated for ${user.email}`);

    res.json({ message: "Credentials updated successfully. System state synchronized. Please sign in." });
  } catch (error) {
    logger.error("[Auth] Reset Commit Failure:", error.message);
    res.status(500).json({ message: "Credential rotation system failure." });
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
    if (!user) return res.status(404).json({ message: "Identity not found in registry." });

    if (user.isApproved) {
      return res.status(400).json({ message: "This account is already in a compliant approved state." });
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
    res.status(500).json({ message: "Strategic Error: Failed to commit approval state." });
  }
};

module.exports = {
  register,
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
  generate2FA,
  verify2FA,
  disable2FA,
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

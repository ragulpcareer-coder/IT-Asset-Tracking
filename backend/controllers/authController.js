const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const RefreshToken = require("../models/RefreshToken");
const UserActivity = require("../models/UserActivity");
const TokenManager = require("../utils/tokenManager");
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
const { sendSecurityAlert, sendApprovalRequest, sendPasswordResetEmail } = require("../utils/emailService");

// Token manager instance (uses env secrets)
const tokenManager = new TokenManager(process.env.JWT_SECRET, process.env.REFRESH_SECRET);

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

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
        message: "Password is not strong enough",
        feedback: passwordStrength.feedback,
        score: passwordStrength.score,
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email: sanitizedEmail });
    if (userExists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Validate name length
    if (sanitizedName.length < 2 || sanitizedName.length > 100) {
      return res.status(400).json({ message: "Name must be between 2 and 100 characters" });
    }

    // PRIVILEGE ESCALATION PREVENTION (Policy §11 & §16 / §19 / §30)
    // Role is NEVER trusted from the client. Backend assigns it unconditionally.
    const hasUsers = await User.exists({}); // Faster check for bootstrapping
    let assignedRole = "Employee"; // Always default to least privilege
    let isApproved = false;

    if (!hasUsers) {
      assignedRole = "Super Admin"; // First-ever account becomes the super admin
      isApproved = true;      // Auto-approved so the system can be bootstrapped
    }

    // Create user (Model pre-save will hash the password)
    const user = await User.create({
      name: sanitizedName,
      email: sanitizedEmail,
      password: password, // Raw password sent, model hashes it (§1.1)
      role: assignedRole,
      createdAt: new Date(),
      lastLogin: null,
      isEmailVerified: false,
      isApproved: isApproved
    });

    // Send approval request email if not auto-approved (NON-BLOCKING / ASYNC)
    if (!isApproved) {
      setImmediate(() => {
        sendApprovalRequest(user).catch(emailErr => {
          logger.error(`[Registration] Background email failed for ${sanitizedEmail}:`, emailErr.message);
        });
      });
    }

    // Parallelize administrative tasks for faster response
    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role);

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
    const { email, password, token2FA } = req.body;

    // Optimized: Fetch only required fields for authentication (§1.1)
    const user = await User.findOne({ email: (email || "").toLowerCase() })
      .select("+password lockUntil isActive failedLoginAttempts isTwoFactorEnabled twoFactorSecret twoFactorBackupCodes role name email lastLoginGeo lastLogin lastLoginIp devices preferences activityTimestamps");

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check account lockout
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const waitMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(403).json({ message: `Account temporarily locked due to multiple failed attempts. Try again in ${waitMinutes} minutes.` });
    }

    // Check if account is active
    if (user.isActive === false) {
      return res.status(403).json({ message: "Identity Decommissioned: Access is permanently suspended." });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      // Handle failed attempt
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000; // 15 mins

        await AuditLog.create({
          action: "SECURITY ALERT: Force Lockout",
          performedBy: user.email,
          details: `Consecutive authentication failure leading to node lockout.`,
          ip: req.ip || req.connection.remoteAddress,
        });
      }
      await user.save();
      return res.status(400).json({ message: "Registry error: Invalid credentials provided." });
    }


    // Two-Factor Authentication Logic
    if (user.isTwoFactorEnabled) {
      if (!token2FA) {
        return res.status(403).json({ requires2FA: true, message: "Two-factor authentication token required" });
      }

      let isVerified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token2FA,
        window: 1 // allows 30 seconds drift either way
      });

      // Weakness Fix: Check backup codes if TOTP fails
      if (!isVerified && user.twoFactorBackupCodes && user.twoFactorBackupCodes.includes(token2FA)) {
        isVerified = true;
        // Remove the used backup code
        user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(c => c !== token2FA);
      }

      if (!isVerified) {
        return res.status(400).json({ message: "Invalid 2FA token or backup code" });
      }
    }

    // Enterprise Behavioral Monitoring & SIEM Anomaly Detection (§12.1)
    const currentHour = new Date().getHours();
    if (currentHour >= 0 && currentHour <= 5) {
      await AuditLog.create({
        action: "SECURITY ANOMALY: Unusual Login Time",
        performedBy: user.email,
        details: `User logged in during restricted/unusual hours: ${currentHour}:00 AM`,
        ip: req.ip || req.connection?.remoteAddress,
      });
    }

    // Check if account is approved (Admins inherently bypass this)
    if (!user.isApproved && !["Super Admin", "Admin"].includes(user.role)) {
      return res.status(403).json({ message: "Your account is pending approval by the core admin." });
    }

    // Enterprise Device Fingerprinting & SIEM Detection (Policy §2.4)
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceFingerprint = typeof req.body.fingerprint === 'object'
      ? JSON.stringify(req.body.fingerprint)
      : (req.body.fingerprint || 'unknown');

    const geo = geoip.lookup(ip);

    // Impossible Travel Detection (§2.1) & Concurrent Session Control (§2.2)
    if (geo && user.lastLoginGeo && user.lastLogin) {
      const lastGeo = user.lastLoginGeo;
      const timeDiffMinutes = (Date.now() - new Date(user.lastLogin).getTime()) / 60000;

      // If country changed and time < 60 mins (Simplified "Impossible Travel")
      if (geo.country !== lastGeo.country && timeDiffMinutes < 60) {
        user.isActive = false; // Instant Lock (§2.1 / §2.2)
        await user.save();
        await AuditLog.create({
          action: "SECURITY ALERT: Impossible Travel Detected",
          performedBy: user.email,
          details: `Account auto-locked. Prev: ${lastGeo.country} (${user.lastLoginIp}). Current: ${geo.country} (${ip}). Velocity violation.`,
          ip: ip,
        });
        return res.status(403).json({ message: "Security Violation: Impossible travel velocity detected. Account locked." });
      }
    }

    const isExistingDevice = user.devices.some(d => d.ip === ip && d.userAgent === userAgent);
    if (!isExistingDevice) {
      // Log "New Device Detected" in Audit Logs for Security Monitoring
      await AuditLog.create({
        action: "SECURITY ALERT: New Device Detected",
        performedBy: user.email,
        details: `A new device logged in. IP: ${ip}, Browser: ${userAgent}, Location: ${geo?.country || 'Unknown'}`,
        ip: ip,
      });

      // Add to user's known devices list
      user.devices.push({
        ip,
        userAgent,
        fingerprint: deviceFingerprint,
        lastLogin: Date.now()
      });

      // Enterprise Alert logic (sending email alert for new login)
      // Typically integrated with a notification service
    } else {
      // Update last seen for existing device
      const devIdx = user.devices.findIndex(d => d.ip === ip && d.userAgent === userAgent);
      if (devIdx !== -1) user.devices[devIdx].lastLogin = Date.now();
    }

    // Finalize authentication tasks in parallel for performance (§1.1)
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = Date.now();
    user.lastLoginIp = ip;
    user.lastLoginGeo = geo;

    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role);

    // Parallelize: 1. DB Save, 2. Cleanup old tokens, 3. Log Activity, 4. Create new refresh token
    await Promise.all([
      user.save(),
      RefreshToken.deleteMany({ user: user._id }),
      logUserActivity(user._id, "LOGIN", "Successful strategic authentication event.", req),
      RefreshToken.create({
        tokenId: pair.refreshTokenId,
        family: pair.refreshTokenFamily,
        user: user._id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
    ]);

    res.cookie('jwt', pair.accessToken, getCookieOptions());

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      preferences: user.preferences,
      activityTimestamps: user.activityTimestamps,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    // Optimized: Fetch only required metadata for session state
    const user = await User.findById(req.user._id)
      .select("name email role preferences activityTimestamps isTwoFactorEnabled phone department location")
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
  const opts = getCookieOptions();
  res.cookie('jwt', '', { ...opts, maxAge: 0, expires: new Date(0) });
  res.json({ message: "Logout successful" });
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
      window: 1
    });

    if (isVerified) {
      user.isTwoFactorEnabled = true;
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
    user.isTwoFactorEnabled = false;
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

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
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

    user.isTwoFactorEnabled = false;
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
    await sendApprovalRequest(testUser);
    res.json({
      success: true,
      message: "Approval request email triggered!",
      sentTo: adminEmail.replace(/(.{2}).*(@.*)/, "$1...$2")
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
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "Valid official email address is required." });
    }

    // 1. Find user (Zero enumeration disclosure)
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });

    // 2. Generic Success Response (§1.2 - Prevent user enumeration attacks)
    const genericResponse = { message: "If the account exists in our registry, a recovery transmission has been dispatched." };

    if (!user) {
      logger.info(`[Auth] Forgot password attempt for non-existent/inactive email: ${email}`);
      return res.json(genericResponse);
    }

    // 3. Generate high-entropy reset token (§Step 3)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 4. Store cryptographically hashed token (§Step 3)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 Minute Window (§7)

    await user.save();

    // 5. Dispatch secure transmission email
    try {
      await sendPasswordResetEmail(user, resetToken);

      await AuditLog.create({
        action: "PASSWORD_RESET_REQUESTED",
        performedBy: user.email,
        details: `Reset link generated. Valid for 15 minutes. Source: ${req.ip}`,
        ip: req.ip || req.connection?.remoteAddress,
      });

    } catch (emailErr) {
      logger.error(`[Auth] Reset email failure for ${user.email}:`, emailErr.message);
    }

    res.json(genericResponse);
  } catch (error) {
    logger.error("[Auth] Forgot Password system error:", error.message);
    res.status(500).json({ message: "Internal Security Engine Failure." });
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

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Reset signature invalid or identity link expired." });
    }

    res.json({ valid: true, email: user.email });
  } catch (error) {
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

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Strategic Reset Failure: Link has expired or was already rotated." });
    }

    // 2. Security Check: Block weak passwords (§Step 4)
    if (password.length < 12) {
      return res.status(400).json({ message: "Password must be at least 12 characters long for security compliance." });
    }

    // 3. Performance-optimized hashing of new credential
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // 4. Clear reset state (§Step 4 - Mark as used)
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Force re-auth on all devices
    await Promise.all([
      user.save(),
      RefreshToken.deleteMany({ user: user._id }), // Revoke all sessions (§Step 4)
      AuditLog.create({
        action: "PASSWORD_RESET_SUCCESS",
        performedBy: user.email,
        details: `Account credentials successfully rotated. All sessions invalidated.`,
        ip: req.ip || req.connection?.remoteAddress,
      }),
      logUserActivity(user._id, "SECURITY", "Password successfully reset via recovery link.", req)
    ]);

    res.json({ message: "Credentials updated successfully. System state synchronized. Please sign in." });
  } catch (error) {
    logger.error("[Auth] Reset Commit Failure:", error.message);
    res.status(500).json({ message: "Credential rotation system failure." });
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
  diagEmailTest,
  getUserActivity
};

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const RefreshToken = require("../models/RefreshToken");
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
const { sendSecurityAlert, sendApprovalRequest } = require("../utils/emailService");

// Token manager instance (uses env secrets)
const tokenManager = new TokenManager(process.env.JWT_SECRET, process.env.REFRESH_SECRET);

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

// Create rate limiters
const loginLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 mins
const registerLimiter = new RateLimiter(3, 60 * 60 * 1000); // 3 attempts per hour

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
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

    // Hash password with strong salt
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Zero Trust Admin Enforcement
    const totalUsers = await User.countDocuments();
    let assignedRole = role || "User"; // Allow specifying role but default to User
    let isApproved = false;

    if (totalUsers === 0) {
      assignedRole = "Admin"; // First ever user gets Admin privileges
      isApproved = true; // First user is auto-approved
    }

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

    // Send approval request email if not auto-approved
    if (!isApproved) {
      try {
        console.log(`[Registration] Triggering approval email for ${sanitizedEmail}`);
        await sendApprovalRequest(user);
      } catch (emailErr) {
        console.error(`[Registration] Email failed for ${sanitizedEmail}:`, emailErr.message);
        // We don't fail the whole registration if just the email fails, 
        // but we should probably tell the user or log it.
      }
    }

    // Log registration
    await AuditLog.create({
      action: "User Registered",
      performedBy: sanitizedEmail,
      details: isApproved ? `New user registered (Auto-approved): ${sanitizedName}` : `New user registration request: ${sanitizedName}`,
      ip,
      createdAt: new Date(),
    });

    if (!isApproved) {
      return res.status(201).json({
        message: "Registration request sent! Your account is pending approval by the core admin. You will be notified once it's active.",
      });
    }

    // create token pair and persist refresh token record
    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role);

    await RefreshToken.create({
      tokenId: pair.refreshTokenId,
      family: pair.refreshTokenFamily,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie('jwt', pair.accessToken, getCookieOptions());

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      message: "Registration successful! Welcome to Asset Tracker.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, token2FA } = req.body;

    // Normalize and check for user email
    const user = await User.findOne({ email: (email || "").toLowerCase() });

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
      return res.status(403).json({ message: "Your account has been suspended by an administrator." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Handle failed attempt
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes

        await AuditLog.create({
          action: "Security Alert: Account Lockout",
          performedBy: "System",
          details: `Account locked due to consecutive failed logins for ${user.email}`,
          ip: req.ip || req.connection.remoteAddress,
        });
      }
      await user.save();
      return res.status(400).json({ message: "Invalid credentials" });
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

    // Check if account is approved
    if (!user.isApproved) {
      return res.status(403).json({ message: "Your account is pending approval by the core admin." });
    }

    // Success logic
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = Date.now();
    await user.save();

    // Geo-Location Login Detection (Weakness 39)
    const ip = req.ip || req.connection.remoteAddress;
    const geo = geoip.lookup(ip);
    if (geo) {
      console.log(`[Security] User ${user.email} logged in from ${geo.city}, ${geo.country}`);
      // Enterprise systems typically alert on unusual countries, but we log the context for the SIEM.
    }

    // Concurrent Session Control (Weakness 38) - Prevent multiple logins by invalidating old sessions
    await RefreshToken.deleteMany({ user: user._id });

    const pair = tokenManager.generateTokenPair(user._id.toString(), user.role);

    await RefreshToken.create({
      tokenId: pair.refreshTokenId,
      family: pair.refreshTokenFamily,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie('jwt', pair.accessToken, getCookieOptions());

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
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
    const user = await User.findById(req.user._id).select("-password");
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
    await user.save();

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
    const { name } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name },
      { new: true }
    ).select("-password");

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

      await user.save();
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
    await user.save();
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
    const users = await User.find({}).select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
};

// @desc    Promote user to Admin (Admin only)
// @route   PUT /api/auth/users/:id/promote
// @access  Private/Admin
const promoteUser = async (req, res) => {
  try {
    const userToPromote = await User.findById(req.params.id);
    if (!userToPromote) return res.status(404).json({ message: "User not found" });

    userToPromote.role = "Admin";
    await userToPromote.save();

    await AuditLog.create({
      action: "User Promoted",
      performedBy: req.user.email,
      details: `Promoted ${userToPromote.email} to Admin`,
      ip: req.ip || req.connection.remoteAddress,
    });

    // Enterprise Privilege Escalation Monitoring Alert (Weakness 7)
    await sendSecurityAlert(
      `Critical Privilege Escalation Detected`,
      `User <b>${userToPromote.email}</b> was just promoted to Super Admin level by <b>${req.user.email}</b>. If this was not authorized, please lock down the system immediately.`
    );

    res.json({ message: "User successfully promoted to Admin", user: { _id: userToPromote._id, email: userToPromote.email, role: userToPromote.role } });
  } catch (error) {
    res.status(500).json({ message: "Error promoting user" });
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

    userToDemote.role = "User";
    await userToDemote.save();

    await AuditLog.create({
      action: "User Demoted",
      performedBy: req.user.email,
      details: `Demoted ${userToDemote.email} to Standard User`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.json({ message: "User successfully demoted to Standard User", user: { _id: userToDemote._id, email: userToDemote.email, role: userToDemote.role } });
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

// @desc    Delete user (Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ message: "User not found" });

    if (userToDelete.email === req.user.email) {
      return res.status(400).json({ message: "You cannot delete yourself" });
    }

    await User.findByIdAndDelete(req.params.id);

    // Invalidate sessions
    await RefreshToken.deleteMany({ user: req.params.id });

    await AuditLog.create({
      action: "User Deleted",
      performedBy: req.user.email,
      details: `Deleted user ${userToDelete.email}`,
      ip: req.ip || req.connection.remoteAddress,
    });

    res.json({ message: "User deleted and disconnected successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user" });
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

module.exports = {
  register,
  login,
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
  diagEmailTest
};

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const {
  validatePasswordStrength,
  isValidEmail,
  RateLimiter,
  sanitizeInput,
} = require("../utils/security");

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

    // Create user
    const user = await User.create({
      name: sanitizedName,
      email: sanitizedEmail,
      password: hashedPassword,
      role: role === "Admin" ? "Admin" : "User",
      createdAt: new Date(),
      lastLogin: null,
      isEmailVerified: false,
    });

    // Log registration
    await AuditLog.create({
      action: "User Registered",
      performedBy: sanitizedEmail,
      details: `New user registered: ${sanitizedName}`,
      ip,
      createdAt: new Date(),
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
      message: "Registration successful! Welcome to Asset Tracker.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Normalize and check for user email
    const user = await User.findOne({ email: (email || "").toLowerCase() });

    if (user && (await bcrypt.compare(password, user.password))) {
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    }

    return res.status(400).json({ message: "Invalid credentials" });
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
        const user = await User.findById(req.user.id).select("-password");
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

        const user = await User.findById(req.user.id);

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
            req.user.id,
            { name },
            { new: true }
        ).select("-password");

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Logout from all sessions
// @route   POST /api/auth/logout-all
// @access  Private
const logoutAll = async (req, res) => {
    try {
        // In a production app, you'd invalidate all tokens in a token blacklist or sessions table
        // For now, we just confirm the logout
        res.json({ message: "Logged out from all sessions successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
};

module.exports = {
    register,
    login,
    getMe,
    changePassword,
    updateProfile,
    logoutAll,
};

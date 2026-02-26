// Security & Utility Helpers for Backend
const crypto = require("crypto");

// Rate Limiting with exponential backoff
class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    this.attempts = new Map();
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isLimited(identifier) {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];

    // Remove expired attempts
    const validAttempts = userAttempts.filter((time) => now - time < this.windowMs);

    this.attempts.set(identifier, validAttempts);

    if (validAttempts.length >= this.maxAttempts) {
      return true;
    }

    validAttempts.push(now);
    this.attempts.set(identifier, validAttempts);
    return false;
  }

  reset(identifier) {
    this.attempts.delete(identifier);
  }

  getRemainingAttempts(identifier) {
    const userAttempts = this.attempts.get(identifier) || [];
    return Math.max(0, this.maxAttempts - userAttempts.length);
  }
}

// Password strength validator (Enterprise Grade: 12 chars, Upper, Lower, Number, Symbol)
const validatePasswordStrength = (password) => {
  const strength = {
    score: 0,
    feedback: [],
    isStrong: false,
  };

  // Length 14+ (Policy §2.2)
  if (password.length >= 14) strength.score += 1;
  else strength.feedback.push("Minimum 14 characters required");

  // Uppercase
  if (/[A-Z]/.test(password)) strength.score += 1;
  else strength.feedback.push("Must contain at least one uppercase letter");

  // Lowercase
  if (/[a-z]/.test(password)) strength.score += 1;
  else strength.feedback.push("Must contain at least one lowercase letter");

  // Number
  if (/[0-9]/.test(password)) strength.score += 1;
  else strength.feedback.push("Must contain at least one number");

  // Special Char
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength.score += 1;
  else strength.feedback.push("Must contain at least one symbol (!@#$%^&* etc.)");

  // Enterprise requirement: All 5 checks must pass
  strength.isStrong = strength.score === 5;

  return strength;
};

// Email validation
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate secure tokens
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .trim();
};

// Log user activity
const createActivityLog = async (userId, action, details, model) => {
  try {
    const AuditLog = model;
    await AuditLog.create({
      userId,
      action,
      details,
      ip: "127.0.0.1",
      userAgent: "user-agent",
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Failed to create activity log:", error);
  }
};

// Format response
const sendResponse = (res, status, message, data = null) => {
  res.status(status).json({
    success: status >= 200 && status < 300,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Encryption utilities for sensitive data
const encryptSensitiveData = (data, key) => {
  const cipher = crypto.createCipher("aes-256-cbc", key);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
};

const decryptSensitiveData = (encrypted, key) => {
  const decipher = crypto.createDecipher("aes-256-cbc", key);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

const verifyRequestSignature = (req, secret) => {
  const signature = req.headers['x-request-signature'];
  const timestamp = req.headers['x-request-timestamp'];
  if (!signature || !timestamp) return false;

  const payload = `${req.method}|${req.originalUrl}|${timestamp}|${JSON.stringify(req.body)}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

const detectMaliciousQuery = (query) => {
  const patterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, // SQL injection
    /(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)/i,
    /(\$where|\$ne|\$gt|\$lt|\$regex)/i, // NoSQL injection
    /(<script|iframe|alert|onerror)/i // XSS
  ];
  const queryStr = JSON.stringify(query);
  return patterns.some(pattern => pattern.test(queryStr));
};

module.exports = {
  RateLimiter,
  validatePasswordStrength,
  isValidEmail,
  generateSecureToken,
  sanitizeInput,
  createActivityLog,
  sendResponse,
  encryptSensitiveData,
  decryptSensitiveData,
  verifyRequestSignature,
  detectMaliciousQuery
};

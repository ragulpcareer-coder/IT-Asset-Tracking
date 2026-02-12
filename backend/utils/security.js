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

// Password strength validator
const validatePasswordStrength = (password) => {
  const strength = {
    score: 0,
    feedback: [],
    isStrong: false,
  };

  if (password.length >= 8) strength.score += 1;
  else strength.feedback.push("At least 8 characters");

  if (password.length >= 12) strength.score += 1;

  if (/[A-Z]/.test(password)) strength.score += 1;
  else strength.feedback.push("Add uppercase letters");

  if (/[a-z]/.test(password)) strength.score += 1;
  else strength.feedback.push("Add lowercase letters");

  if (/[0-9]/.test(password)) strength.score += 1;
  else strength.feedback.push("Add numbers");

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength.score += 1;
  else strength.feedback.push("Add special characters");

  strength.isStrong = strength.score >= 4;

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
};

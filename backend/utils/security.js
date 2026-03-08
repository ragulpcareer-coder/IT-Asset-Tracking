// Security and utility helpers for backend
const crypto = require("crypto");

// Rate limiting with in-memory rolling window
class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    this.attempts = new Map();
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isLimited(identifier) {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];

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

const validatePasswordStrength = (password) => {
  const strength = {
    score: 0,
    feedback: [],
    isStrong: false,
  };

  if (password.length >= 8) strength.score += 1;
  else strength.feedback.push("Minimum 8 characters required");

  if (/[A-Z]/.test(password)) strength.score += 1;
  else strength.feedback.push("Must contain at least one uppercase letter");

  if (/[a-z]/.test(password)) strength.score += 1;
  else strength.feedback.push("Must contain at least one lowercase letter");

  if (/[0-9]/.test(password)) strength.score += 1;
  else strength.feedback.push("Must contain at least one number");

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength.score += 1;
  else strength.feedback.push("Must contain at least one symbol (!@#$%^&* etc.)");

  strength.isStrong = strength.score === 5;
  return strength;
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateSecureToken = (length = 32) => crypto.randomBytes(length).toString("hex");

const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input.replace(/[<>]/g, "").replace(/javascript:/gi, "").trim();
};

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

const sendResponse = (res, status, message, data = null) => {
  res.status(status).json({
    success: status >= 200 && status < 300,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

const deriveAesKey = (key) => {
  if (!key || typeof key !== "string") {
    throw new Error("Encryption key is required");
  }
  return crypto.createHash("sha256").update(key).digest();
};

// Format: v2:<ivHex>:<authTagHex>:<cipherHex>
const encryptSensitiveData = (data, key) => {
  const input = typeof data === "string" ? data : JSON.stringify(data);
  const aesKey = deriveAesKey(key);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(input, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v2:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decryptSensitiveData = (encrypted, key) => {
  if (typeof encrypted !== "string") {
    throw new Error("Encrypted payload must be a string");
  }

  if (!encrypted.startsWith("v2:")) {
    throw new Error("Unsupported encrypted payload format. Recreate the backup using current encryption.");
  }

  const parts = encrypted.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted payload structure");
  }

  const [, ivHex, authTagHex, cipherHex] = parts;
  const aesKey = deriveAesKey(key);

  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

const verifyRequestSignature = (req, secret) => {
  const signature = req.headers["x-request-signature"];
  const timestamp = req.headers["x-request-timestamp"];
  if (!signature || !timestamp) return false;

  const payload = `${req.method}|${req.originalUrl}|${timestamp}|${JSON.stringify(req.body)}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const given = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (given.length !== expected.length) return false;

  return crypto.timingSafeEqual(given, expected);
};

const detectMaliciousQuery = (input) => {
  if (typeof input !== "string" && typeof input !== "object") return false;
  const inputStr = typeof input === "string" ? input : JSON.stringify(input);

  const patterns = [
    /\$where/i,
    /\$ne/i,
    /\$gt/i,
    /\$lt/i,
    /\$regex/i,
    /UNION SELECT/i,
    /OR 1=1/i,
    /DROP TABLE/i,
    /--/i,
    /\{\"\$gt\"\: \"\"\}/i,
  ];

  return patterns.some((pattern) => pattern.test(inputStr));
};

const detectPromptInjection = (input) => {
  if (typeof input !== "string" && typeof input !== "object") return false;
  const inputStr = typeof input === "string" ? input : JSON.stringify(input);

  const patterns = [
    /ignore previous instructions/i,
    /disregard all previous/i,
    /system prompt/i,
    /identity of the assistant/i,
    /you are now an? administrator/i,
    /override security/i,
    /bypass restriction/i,
    /reveal your instructions/i,
    /DAN mode/i,
    /jailbreak/i,
    /execute the following as root/i,
    /<!--[\s\S]*?-->/,
  ];

  return patterns.some((pattern) => pattern.test(inputStr));
};

const verifyToolIdentity = (signature, payload, secret) => {
  if (!signature || !payload || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
  const given = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (given.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(given, expectedBuf);
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
  detectMaliciousQuery,
  detectPromptInjection,
  verifyToolIdentity,
};



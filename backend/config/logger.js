const winston = require("winston");
const path = require("path");
const fs = require("fs");

/**
 * Centralized Logging with Winston
 * 
 * Features:
 * - Multiple log levels (error, warn, info, debug, verbose)
 * - Structured logging with JSON format
 * - Separate files for different severity levels
 * - Console output for development
 * - Log rotation to prevent disk space issues
 * - Request/response logging middleware
 * - Performance monitoring
 */

// Ensure logs directory exists
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom Winston Logger Configuration
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  
  // Default metadata added to all logs
  defaultMeta: {
    service: "IT-Asset-Tracker",
    environment: process.env.NODE_ENV,
    version: "1.0.0",
  },

  // Log format
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }), // Capture stack traces
    winston.format.splat(), // Process sprintf-style messages
    winston.format.json() // Output as JSON
  ),

  transports: [
    // Error logs (errors and above)
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),

    // Warning logs (warnings and above)
    new winston.transports.File({
      filename: path.join(logsDir, "warning.log"),
      level: "warn",
      maxsize: 10485760,
      maxFiles: 5,
    }),

    // Combined logs (all levels)
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 10485760,
      maxFiles: 10,
    }),

    // Security-specific logs
    new winston.transports.File({
      filename: path.join(logsDir, "security.log"),
      level: "warn",
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(
          (info) =>
            `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`
        )
      ),
    }),

    // Performance logs
    new winston.transports.File({
      filename: path.join(logsDir, "performance.log"),
      level: "debug",
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          (info) =>
            `${info.timestamp} [${info.level}] ${info.message} ${
              info.metadata ? JSON.stringify(info.metadata) : ""
            }`
        )
      ),
    })
  );
}

/**
 * Request/Response Logging Middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    const logData = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get("user-agent"),
      ip: req.ip,
      userId: req.user?.id || "anonymous",
      timestamp: new Date().toISOString(),
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error(`HTTP ${res.statusCode}`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP ${res.statusCode}`, logData);
    } else if (duration > 1000) {
      // Log slow requests
      logger.warn("Slow Request", { ...logData, slow: true });
    } else {
      logger.info(`HTTP ${res.statusCode}`, logData);
    }
  });

  next();
};

/**
 * Security Event Logger
 * Log authentication, authorization, and security events
 */
const securityLogger = ({
  event,
  userId,
  email,
  ip,
  action,
  resource,
  status,
  details,
}) => {
  const logEntry = {
    event,
    userId,
    email,
    ip,
    action,
    resource,
    status,
    details,
    timestamp: new Date().toISOString(),
  };

  if (status === "failure" || event === "suspicious") {
    logger.warn("Security Event", logEntry);
  } else {
    logger.info("Security Event", logEntry);
  }
};

/**
 * Performance Logger
 * Log slow database queries and API responses
 */
const performanceLogger = ({ operation, duration, threshold = 100 }) => {
  if (duration > threshold) {
    logger.debug("Performance Alert", {
      operation,
      duration: `${duration}ms`,
      threshold: `${threshold}ms`,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Error Logger with Context
 */
const errorLogger = ({
  error,
  context,
  userId,
  request,
  statusCode = 500,
}) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    context,
    userId,
    request: {
      method: request?.method,
      url: request?.url,
      ip: request?.ip,
    },
    statusCode,
    timestamp: new Date().toISOString(),
  };

  logger.error("Application Error", errorData);
};

/**
 * Audit Log Formatter
 * Format audit events for security compliance
 */
const auditLogger = ({
  action,
  performedBy,
  resource,
  resourceId,
  changes,
  ip,
  status,
}) => {
  const auditEntry = {
    action,
    performedBy,
    resource,
    resourceId,
    changes,
    ip,
    status,
    timestamp: new Date().toISOString(),
  };

  logger.info("Audit Event", auditEntry);
};

/**
 * Get logs summary
 */
const getLogsSummary = () => {
  return {
    logDirectory: logsDir,
    files: [
      "error.log - Errors and critical issues",
      "warning.log - Warnings and security events",
      "combined.log - All log levels",
      "security.log - Authentication, authorization, suspicious activity",
      "performance.log - Slow operations and performance metrics",
    ],
    logLevels: ["error", "warn", "info", "verbose", "debug", "silly"],
  };
};

/**
 * Clear old logs
 */
const clearOldLogs = async (daysOld = 30) => {
  const now = Date.now();
  const cutoff = now - daysOld * 24 * 60 * 60 * 1000;

  try {
    const files = fs.readdirSync(logsDir);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    logger.info(`Old logs cleanup completed. Deleted: ${deletedCount} files`);
  } catch (error) {
    logger.error("Failed to cleanup old logs", { error: error.message });
  }
};

module.exports = {
  logger,
  requestLogger,
  securityLogger,
  performanceLogger,
  errorLogger,
  auditLogger,
  getLogsSummary,
  clearOldLogs,
};

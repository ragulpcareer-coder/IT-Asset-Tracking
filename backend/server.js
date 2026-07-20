const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require('fs');
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const logger = require('./utils/logger');
const ipBlockerMiddleware = require("./middleware/ipBlockerMiddleware");
const TokenManager = require("./utils/tokenManager");

// 1. Environment Configuration
dotenv.config();

const User = require("./models/User");
const connectDB = require("./config/db");

// BOOT CHECK — validate critical env vars immediately after dotenv loads.
// Do this before ANYTHING else so crashes are predictable and logged cleanly.
// Note: We use console.warn (not process.exit) so the server still starts
// and the /diag endpoint can always respond — making remote diagnosis possible.
const REQUIRED_ENV = ["JWT_SECRET", "MONGO_URI", "DB_ENCRYPTION_SECRET", "REFRESH_SECRET"];
let bootFatal = false;
REQUIRED_ENV.forEach(v => {
  if (!process.env[v]) {
    console.error(`\n🔴 [BOOT] FATAL: Missing env var: ${v}`);
    bootFatal = true;
  } else {
    console.log(`✅ [BOOT] ${v} is set (${process.env[v].length} chars)`);
  }
});
if (bootFatal) {
  console.error('🔴 [BOOT] One or more critical env vars are missing. Login WILL fail.');
  console.error('🔴 [BOOT] Open https://<your-render-service>/diag to see which vars are missing.');
  // Do NOT process.exit — keep the server alive so /diag responds
}

// 2. Database Connection
connectDB();

const app = express();
const server = http.createServer(app);

// 3. Trust Proxy for correct IP detection (Critical for Rate Limiting / GeoIP)
app.set("trust proxy", 1);

// 4. Security Networking (CORS) (§43, §44)
const tokenManager = new TokenManager(process.env.JWT_SECRET, process.env.REFRESH_SECRET);
const configuredOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = process.env.NODE_ENV === "production"
  ? configuredOrigins
  : [...new Set([
    ...configuredOrigins,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
  ])];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) {
      callback(null, origin);
    } else {
      console.warn(`[CORS-Forensic] BLOCKED: ${origin}`);
      callback(new Error('Identity Policy: Cross-origin access denied.'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-Timestamp", "X-Agent-Signature", "X-Requested-With", "Accept"],
  exposedHeaders: ["X-CSRF-Token", "X-Request-Timestamp"]
};

app.use(cors(corsOptions));

// Preflight OPTIONS handler
app.options("*", cors(corsOptions));

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (unsafeMethods.has(req.method) && origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: request origin is not trusted.",
      errors: { origin: "not_allowed" },
    });
  }
  next();
});

// 5. Socket.io Configuration
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) {
        callback(null, origin);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"]
  },
  allowEIO3: true // Helps with some older connection transports
});
app.set("io", io);
global.io = io; // Set global.io for utils/services to access easily

const getCookieValue = (cookieHeader = "", name) => {
  return cookieHeader
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => pair.split("="))
    .find(([key]) => key === name)?.[1];
};

io.use(async (socket, next) => {
  try {
    const cookieToken = getCookieValue(socket.handshake.headers?.cookie || "", "jwt");
    const authToken = socket.handshake?.auth?.token;
    const token = cookieToken || authToken;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const verified = tokenManager.verifyAccessToken(decodeURIComponent(token));
    if (!verified.valid) {
      return next(new Error("Invalid socket token"));
    }

    const user = await User.findById(verified.decoded.userId)
      .select("_id email role isActive");
    if (!user || user.isActive === false) {
      return next(new Error("Unauthorized socket identity"));
    }

    socket.user = user;
    return next();
  } catch (error) {
    return next(new Error("Socket authentication failed"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.user._id.toString()}`);
});

// 6. Security & Optimization Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression({
  level: 6, // Optimized compression level for speed/ratio balance
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
app.use(express.json({ limit: "10kb" })); // §46: Request size limit
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(mongoSanitize()); // §41: NoSQL Injection Protection
app.use(xss()); // §42: XSS Protection

// Fail loud and fast, not vague and slow: ipBlockerMiddleware (next) and
// most routes query MongoDB. If it isn't connected, Mongoose queues
// ("buffers") those queries for up to 10 seconds before timing out, so
// every request would otherwise hang for 10s and then fail with whatever
// generic message that particular catch block happens to use —
// "Unable to validate email right now," "Registration failed," etc. —
// which all look like different bugs but share one root cause. Checking
// the connection state here, before anything touches the database,
// turns that into one immediate, specific, actionable response instead.
app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/diag") return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "The database is not connected. Check MONGO_URI in backend/.env and confirm MongoDB is running, then restart the server.",
      errors: { database: "not_connected" },
    });
  }
  return next();
});

// 6.5. Global IP Blacklist (Automated Incident Response mitigations)
app.use(ipBlockerMiddleware);

// 7. Rate Limiting Logic (§7, §8, §45)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    errors: { rateLimit: "too_many_requests" }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login limiter — IMPORTANT: max is 20 (not 10) because 2FA login takes 2 requests:
//   Request 1: email+password  → 401 { requires2FA: true }  (correct behaviour, app continues)
//   Request 2: email+password+token → 200 success
// With max:10, a user with 2FA enabled effectively only gets 5 full login attempts.
// skipSuccessfulRequests:true ensures successfully completed logins don't burn the quota.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,   // only count failed/401 attempts, not successful logins
  message: {
    success: false,
    message: "Too many failed login attempts. Please wait 15 minutes before trying again.",
    errors: { auth: "rate_limited" }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many password reset requests. Please wait 15 minutes before trying again.",
    errors: { email: "rate_limited" }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);

// 8. SIEM & Performance Logging Integration (§47)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`TRAFFIC: ${req.method} ${req.url} [${res.statusCode}] - ${duration}ms`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      duration,
      path: req.path
    });

    // Alert SOC if authentication endpoints are unusually slow
    if (duration > 1000 && (req.path.includes('/login') || req.path.includes('/register'))) {
      logger.warn(`PERFORMANCE_ALERT: Slow Auth detected - ${duration}ms on ${req.url}`);
    }
  });
  next();
});

// 9. Deception System (Honeypot §23)
app.use("/api/admin/config/v1/root", (req, res) => {
  logger.warn(`HONEYPOT TRIGGERED: IP ${req.ip} accessed restricted root config.`);
  setTimeout(() => res.status(404).json({ error: "System kernel failure." }), 5000);
});

const getDbStatus = () => {
  const mongoose = require("mongoose");
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  return {
    state: dbStates[mongoose.connection.readyState] || "unknown",
    host: mongoose.connection.host || "not connected",
  };
};

const buildHealthPayload = () => ({
  status: "OK",
  timestamp: new Date().toISOString(),
  db: getDbStatus(),
});

// Root route (prevents 404 on browser visits and platform health checks)
app.get("/", (req, res) =>
  res.status(200).json({
    name: "AssetTrack SOC API",
    description: "Enterprise IT Asset Tracking & Security Monitoring Platform",
    version: "2.5.0",
    status: "running",
    timestamp: new Date().toISOString(),
  })
);

// Health aliases used by local checks, uptime monitors, and API tests
app.get("/health", (req, res) => res.status(200).json(buildHealthPayload()));
app.get("/api/health", (req, res) => res.status(200).json(buildHealthPayload()));
app.get("/api/health/db", (req, res) => res.status(200).json(getDbStatus()));

// /diag — shows env var presence and DB state WITHOUT exposing values.
// Intentionally at root (not /api/) so app.use('/api', apiV1) never intercepts it.
app.get("/diag", (req, res) => {
  const mongoose = require("mongoose");
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  res.status(200).json({
    status: "running",
    timestamp: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || 'not set',
    envVars: {
      JWT_SECRET: !!process.env.JWT_SECRET,
      REFRESH_SECRET: !!process.env.REFRESH_SECRET,
      DB_ENCRYPTION_SECRET: !!process.env.DB_ENCRYPTION_SECRET,
      MONGO_URI: !!process.env.MONGO_URI,
      FRONTEND_URL: !!process.env.FRONTEND_URL,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    },
    db: {
      state: dbStates[mongoose.connection.readyState] || "unknown",
      host: mongoose.connection.host || "not connected",
    },
    loginWillWork: !!process.env.JWT_SECRET && !!process.env.REFRESH_SECRET && !!process.env.DB_ENCRYPTION_SECRET && !!process.env.MONGO_URI,
  });
});



// Implementation of Versioned APIs (§39)
const apiV1 = express.Router();


// Mount V1 Modules
apiV1.use("/auth", require("./routes/authRoutes"));
apiV1.use("/assets", require("./routes/assetRoutes"));
apiV1.use("/audit", require("./routes/auditRoutes"));
apiV1.use("/tickets", require("./routes/ticketRoutes"));
apiV1.use("/software", require("./routes/softwareRoutes"));
apiV1.use("/keys", require("./routes/apiRoutes"));
apiV1.use("/pending", require("./routes/pendingActionRoutes"));
apiV1.use("/maintenance", require("./routes/maintenanceRoutes"));
apiV1.use("/dashboard", require("./routes/dashboardRoutes"));
apiV1.use("/security", require("./routes/securityRoutes")); // SOC Platform — alerts, incidents, simulations
apiV1.use("/onboarding", require("./routes/onboardingRoutes"));
apiV1.use("/checkin", require("./routes/checkinRoutes"));
apiV1.use("/procurement", require("./routes/procurementRoutes"));

// Multi-version support (§39)
app.use("/api/public", require("./routes/publicRoutes"));
app.use("/api/v1", apiV1);
app.use("/api", apiV1); // Alias for legacy/standard support

// 11. Strategic Config Audit — already checked at boot (top of file)
// Global crash handlers — prevent silent process death (§35)
process.on('uncaughtException', (err) => {
  console.error('🔴 UNCAUGHT EXCEPTION — Server will continue but this needs fixing:');
  console.error('  Name   :', err.name);
  console.error('  Message:', err.message);
  console.error('  Stack  :', err.stack?.split('\n').slice(0, 4).join(' | '));
  logger.error('UNCAUGHT_EXCEPTION', { name: err.name, message: err.message });
  // Note: Do NOT process.exit here — Render will restart the service.
  // Exiting on every uncaught exception causes restart loops which cause 503s.
});

process.on('unhandledRejection', (reason) => {
  console.error('🔴 UNHANDLED PROMISE REJECTION:');
  console.error('  Reason:', reason?.message || reason);
  logger.error('UNHANDLED_REJECTION', { reason: reason?.message || String(reason) });
});


// 11. Cron Jobs Integration
try {
  require('./jobs/auditRetentionJob');
  require('./jobs/warrantyJob');
  require('./jobs/backupJob');
  require('./jobs/pingWatchdog');
  require('./jobs/networkDiscoveryJob');
  require('./jobs/keepAliveJob');
  require('./jobs/lifecycleJob');
} catch (err) {
  console.warn('Job Initialization Warning:', err.message);
}

// 12. Global Error Handlers (§32, §35)
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
app.use(notFound);
app.use(errorHandler);

// 13. Server Bootstrap
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ENTERPRISE SERVER ACTIVE ON PORT ${PORT}`);
  console.log(`[BOOT] Listening on 0.0.0.0:${PORT} (Render-compatible binding)`);
  logger.info(`SERVER_START: Port=${PORT} Node=${process.version} Env=${process.env.NODE_ENV}`);
});



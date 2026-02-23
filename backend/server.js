const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

const fs = require('fs');

// Advanced Environment Configuration
const envPath = path.resolve(__dirname, "backend.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // If backend.env doesn't exist, try standard .env or rely on environment variables (like in Render)
  dotenv.config();
}

connectDB();

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Allow frontend origins (default to common Vite ports); can override with FRONTEND_URL env
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  FRONTEND_URL
];

const checkOrigin = function (origin, callback) {
  // Allow all origins to bypass Render's strict CORS blocking from Vercel preview domains
  return callback(null, true);
  return callback(new Error("Not allowed by CORS"));
};

const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    methods: ["GET", "POST"],
  },
});

// Make io accessible to routes
app.set("io", io);

try {
  require('./jobs/auditRetentionJob');
} catch (err) {
  console.warn('Could not start audit retention job', err.message);
}

try {
  require('./jobs/warrantyJob');
} catch (err) {
  console.warn('Could not start warranty job', err.message);
}

try {
  require('./jobs/backupJob');
} catch (err) {
  console.warn('Could not start professional backup job', err.message);
}

try {
  require('./jobs/pingWatchdog');
} catch (err) {
  console.warn('Could not start ping watchdog job', err.message);
}

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const compression = require("compression");

// Security & Networking Middlewares
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
app.use(compression()); // Compress all responses for advanced networking efficiency
app.use(
  cors({
    origin: checkOrigin,
    credentials: true
  })
);
const cookieParser = require("cookie-parser");
const csurf = require("csurf");
app.use(express.json({ limit: "10kb" })); // Body parser limit to prevent payload attacks
app.use(cookieParser());

// CSRF Protection configuration (Enterprise OWASP fix)
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
  }
});
// Apply to routes below, but add an endpoint to get the token
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Data Sanitization against NoSQL query injection
app.use(mongoSanitize());

// Enterprise SIEM Logging Integration
const logger = require('./utils/logger');
app.use((req, res, next) => {
  logger.info(`HTTP ${req.method} ${req.url}`, {
    ip: req.ip,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Data Sanitization against XSS
app.use(xss());

// Advanced Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, your account has been temporarily restricted.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", globalLimiter);
app.use("/api/auth/login", authLimiter);

// Note: In an extreme Enterprise setting, we'd apply csrfProtection globally to all state-changing routes
// Here we apply it selectively or pass it based on frontend capabilities. To strictly enforce:
// app.use("/api/", csrfProtection); 

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/assets", require("./routes/assetRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));
// Advanced Modules
app.use("/api/tickets", require("./routes/ticketRoutes"));
app.use("/api/software", require("./routes/softwareRoutes"));
app.use("/api/keys", require("./routes/apiRoutes"));

app.get("/api/diag/email", async (req, res) => {
  const { transporter } = require("./utils/emailService");
  const maskEmail = (email) => {
    if (!email) return "not set";
    const parts = email.split("@");
    return `${parts[0][0]}...${parts[0][parts[0].length - 1]}@${parts[1]}`;
  };
  const smtpStatus = await new Promise((resolve) => {
    transporter.verify((error) => {
      resolve(error ? `Error: ${error.message}` : "Ready");
    });
  });

  res.json({
    emailUser: maskEmail(process.env.EMAIL_USER),
    adminEmail: maskEmail(process.env.ADMIN_EMAIL),
    userLen: process.env.EMAIL_USER?.length,
    passLen: process.env.EMAIL_PASS?.length,
    smtpStatus: smtpStatus,
    configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.ADMIN_EMAIL)
  });
});

app.get("/api/diag/email-test", async (req, res) => {
  const { sendApprovalRequest } = require("./utils/emailService");
  try {
    const testUser = {
      _id: "test_id_123",
      name: "Test Diagnostic",
      email: "test@example.com",
      role: "User"
    };
    await sendApprovalRequest(testUser);
    res.json({ message: "Test email trigger successful! Check your inbox.", details: "Look at server logs for details." });
  } catch (err) {
    res.status(500).json({ error: "Test trigger failed", message: err.message, stack: err.stack });
  }
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message || "Server Error",
  });
});

const PORT = process.env.PORT || 5000;

// Try to listen on the configured port. If it's in use, fall back to an ephemeral port.
const tryListen = (port) => {
  const onError = (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use — trying a random available port instead...`);
      // Remove this error listener before trying again to avoid recursion
      server.removeListener('error', onError);
      // Listen on port 0 to let OS pick a free port
      server.listen(0);
      return;
    }
    console.error('Server error:', err);
    process.exit(1);
  };

  server.on('error', onError);

  server.listen(port, () => {
    console.log(`🚀 Server running on port ${server.address().port}`);
    // once we've successfully started, remove the error listener
    server.removeListener('error', onError);
  });
};

tryListen(PORT);


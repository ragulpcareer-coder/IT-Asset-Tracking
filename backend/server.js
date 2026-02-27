const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const fs = require('fs');
const http = require("http");
const { Server } = require("socket.io");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const csurf = require("csurf");
const logger = require('./utils/logger');

// 1. Environment Configuration
const envPath = path.resolve(__dirname, "backend.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// 2. Database Connection
connectDB();

const app = express();
const server = http.createServer(app);

// 3. Trust Proxy for correct IP detection (Critical for Rate Limiting / GeoIP)
app.set("trust proxy", 1);

// 4. Security Networking (CORS) (§43, §44)
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  FRONTEND_URL,
  "https://it-asset-tracking-ragul.vercel.app",
  "https://it-asset-tracking-ragulpcareer-coders-projects.vercel.app"
];


app.use(cors({
  origin: function (origin, callback) {
    // Explicitly allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Dynamic Origin Validation (§43, §44)
    // Supports Localhost, Production domain, and ALL Vercel subdomains/previews
    const isVercelOrigin = origin.endsWith(".vercel.app") &&
      (origin.includes("it-asset-tracking") || origin.includes("it-asset"));
    const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");

    if (allowedOrigins.indexOf(origin) !== -1 || isVercelOrigin || isLocalhost) {
      callback(null, true);
    } else {
      console.warn(`[CORS-Forensic] BLOCKED: ${origin}`);
      callback(new Error('Identity Policy: Cross-origin access denied.'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-Timestamp", "X-Agent-Signature", "X-Requested-With", "Accept"],
  exposedHeaders: ["X-CSRF-Token", "X-Request-Timestamp"]
}));

// 5. Socket.io Configuration
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
});
app.set("io", io);

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

// 7. Rate Limiting Logic (§7, §8, §45)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Security Protocol: Too many authentication attempts. Please verify identity and try again in 15 mins." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

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

// 10. API Routes (Enterprise Versioning §39)
app.get("/health", (req, res) => res.status(200).json({ status: "OK", timestamp: new Date() }));

// CSRF Protection configuration
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
  }
});

// Implementation of Versioned APIs (§39)
const apiV1 = express.Router();

apiV1.get("/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Mount V1 Modules
apiV1.use("/auth", require("./routes/authRoutes"));
apiV1.use("/assets", require("./routes/assetRoutes"));
apiV1.use("/audit", require("./routes/auditRoutes"));
apiV1.use("/tickets", require("./routes/ticketRoutes"));
apiV1.use("/software", require("./routes/softwareRoutes"));
apiV1.use("/keys", require("./routes/apiRoutes"));
apiV1.use("/pending", require("./routes/pendingActionRoutes"));
apiV1.use("/maintenance", require("./routes/maintenanceRoutes"));

// Multi-version support (§39)
app.use("/api/v1", apiV1);
app.use("/api", apiV1); // Alias for legacy/standard support

// 11. Strategic Config Audit (§49)
const requiredEnv = ["JWT_SECRET", "MONGO_URI"];
requiredEnv.forEach(v => {
  if (!process.env[v]) {
    logger.error(`BOOTSTRAP FATAL: Missing Critical Variable: ${v}`);
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }
});


// 11. Cron Jobs Integration
try {
  require('./jobs/auditRetentionJob');
  require('./jobs/warrantyJob');
  require('./jobs/backupJob');
  require('./jobs/pingWatchdog');
  require('./jobs/keepAliveJob');
} catch (err) {
  console.warn('Job Initialization Warning:', err.message);
}

// 12. Global Error Handlers (§32, §35)
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
app.use(notFound);
app.use(errorHandler);

// 13. Server Bootstrap
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 ENTERPRISE SERVER ACTIVE ON PORT ${PORT}`);
  logger.info(`SERVER_START: Node ${process.version}, Environment ${process.env.NODE_ENV}`);
});

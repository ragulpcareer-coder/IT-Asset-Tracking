const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

dotenv.config({ path: path.resolve(__dirname, "backend.env") });
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
  contentSecurityPolicy: false, // Let frontend handle its own CSP or configure properly 
  crossOriginEmbedderPolicy: false
}));
app.use(compression()); // Compress all responses for advanced networking efficiency
app.use(
  cors({
    origin: checkOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "10kb" })); // Body parser limit to prevent payload attacks

// Data Sanitization against NoSQL query injection
app.use(mongoSanitize());

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
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/assets", require("./routes/assetRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));
// Advanced Modules
app.use("/api/tickets", require("./routes/ticketRoutes"));
app.use("/api/software", require("./routes/softwareRoutes"));
app.use("/api/keys", require("./routes/apiRoutes"));

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


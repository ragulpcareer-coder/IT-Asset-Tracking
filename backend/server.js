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
];

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
  },
});

// Make io accessible to routes
app.set("io", io);

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/assets", require("./routes/assetRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));

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

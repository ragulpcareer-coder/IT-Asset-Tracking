# Advanced Features Integration Guide

Complete guide for implementing and using all advanced features in the IT Asset Tracker.

## 📋 Table of Contents

1. [Refresh Token Rotation](#refresh-token-rotation)
2. [Role-Based Access Control (RBAC)](#rbac-middleware)
3. [Audit Log Tamper Protection](#audit-log-tamper-protection)
4. [Asset Lifecycle State Machine](#asset-lifecycle)
5. [Warranty Expiry Automation](#warranty-expiry-automation)
6. [Database Indexing Strategy](#database-indexing)
7. [Centralized Logging (Winston)](#centralized-logging)
8. [Error Tracking (Sentry)](#error-tracking)
9. [API Versioning](#api-versioning)
10. [Docker Deployment](#docker-deployment)
11. [CI/CD Pipeline](#cicd-pipeline)

---

## Refresh Token Rotation

### Overview
Implements JWT best practices with short-lived access tokens and rotating refresh tokens.

**Features:**
- 15-minute access tokens
- 7-day refresh tokens with family tracking
- Automatic token rotation on refresh
- Token family tracking to prevent replay attacks

### Implementation

#### 1. Update User Model

```javascript
// models/User.js - Add refresh token fields
const userSchema = new Schema({
  // ... existing fields
  refreshTokenFamily: String,     // Track token family
  refreshTokenId: String,         // Current refresh token ID
  refreshTokenExpiry: Date,       // When current refresh token expires
  revokedTokens: [String],        // Blacklist revoked tokens
});
```

#### 2. Update Auth Controller

```javascript
// controllers/authController.js
const TokenManager = require("../utils/tokenManager");

const tokenManager = new TokenManager();

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const tokenPair = tokenManager.generateTokenPair(user._id, user.role);

    // Store refresh token metadata
    user.refreshTokenFamily = tokenPair.refreshTokenFamily;
    user.refreshTokenId = tokenPair.refreshTokenId;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const verification = tokenManager.verifyRefreshToken(refreshToken);
    if (!verification.valid) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(verification.decoded.userId);

    // Check if token family matches (detect token reuse attack)
    if (user.refreshTokenFamily !== verification.decoded.family) {
      // Possible account compromise - revoke all tokens
      user.revokedTokens.push(user.refreshTokenId);
      await user.save();
      return res.status(401).json({
        message: "Token reuse detected. All sessions revoked. Please login again.",
      });
    }

    // Rotate token - issue new pair
    const newTokenPair = tokenManager.rotateRefreshToken(
      user._id,
      user.role,
      verification.decoded.family
    );

    // Update user with new token
    user.refreshTokenId = newTokenPair.refreshTokenId;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({
      accessToken: newTokenPair.accessToken,
      refreshToken: newTokenPair.refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

#### 3. Frontend Integration

```javascript
// frontend/src/services/axiosConfig.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

let refreshTokenPromise = null;

// Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshTokenPromise) {
        refreshTokenPromise = api
          .post("/auth/refresh", {
            refreshToken: localStorage.getItem("refreshToken"),
          })
          .then((response) => {
            localStorage.setItem("accessToken", response.data.accessToken);
            localStorage.setItem("refreshToken", response.data.refreshToken);

            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
            refreshTokenPromise = null;

            return api(originalRequest);
          })
          .catch(() => {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            window.location.href = "/login";
            refreshTokenPromise = null;
          });
      }

      return refreshTokenPromise;
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

## RBAC Middleware

### Overview
Implements role-based access control with permission matrix enforcement.

**Roles:**
- `Admin` - Full permissions
- `Manager` - Asset management and reporting
- `User` - Read-only access to own resources

### Implementation

#### 1. Update Routes

```javascript
// routes/assetRoutes.js
const {
  authorizeResource,
  verifyOwnership,
  authorizeRoles,
} = require("../middleware/rbacMiddleware");

// Admin-only route
router.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles("Admin"),
  deleteAsset
);

// Manager+ route with ownership verification
router.put(
  "/:id",
  authenticateJWT,
  authorizeResource("assets", "update"),
  verifyOwnership("Asset"),
  updateAsset
);

// Anyone can read assets
router.get(
  "/:id",
  authenticateJWT,
  authorizeResource("assets", "read"),
  getAsset
);
```

#### 2. Get Permission Matrix (Frontend)

```javascript
// Frontend component
const [permissions, setPermissions] = useState({});

useEffect(() => {
  api.get("/auth/permissions").then((response) => {
    setPermissions(response.data.permissions);
  });
}, []);

// Show/hide UI based on permissions
{
  permissions.assets?.includes("delete") && (
    <button onClick={deleteAsset}>Delete</button>
  )
}
```

---

## Audit Log Tamper Protection

### Overview
Cryptographic verification to prevent unauthorized modification of audit logs.

### Implementation

#### 1. Create Protected Log Entry

```javascript
// In auth controller
const AuditLogSecurity = require("../utils/auditLogSecurity");

await AuditLog.create(
  AuditLogSecurity.createTamperProtectedLog(
    {
      action: "User Login",
      performedBy: user.email,
      ip: req.ip,
      timestamp: new Date(),
    },
    previousLog?.hash,
    process.env.AUDIT_SECRET
  )
);
```

#### 2. Verify Log Integrity

```javascript
// Admin endpoint to verify logs
app.get("/api/audit/verify", async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(1000);

  const report = AuditLogSecurity.generateIntegrityReport(
    logs,
    process.env.AUDIT_SECRET
  );

  res.json(report);
});
```

---

## Asset Lifecycle

### Overview
State machine for asset lifecycle with valid transitions.

**States:** `new` → `active` → `maintenance` → `deprecated` → `archived`

### Implementation

#### 1. Update Asset Model

```javascript
// models/Asset.js
const assetSchema = new Schema({
  // ... existing fields
  status: {
    type: String,
    enum: ["new", "active", "maintenance", "deprecated", "archived"],
    default: "new",
  },
  statusHistory: [
    {
      status: String,
      changedBy: String,
      changedAt: Date,
      reason: String,
    },
  ],
  lifecycleMetadata: {
    createdAt: Date,
    activeAt: Date,
    maintenanceCount: Number,
    deprecatedAt: Date,
    archivedAt: Date,
  },
});
```

#### 2. Transition Handler

```javascript
// controllers/assetController.js
const AssetLifecycle = require("../utils/assetLifecycle");

const updateAssetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, reason } = req.body;

    const asset = await Asset.findById(id);

    // Validate transition
    const validation = AssetLifecycle.validateTransition(
      asset.status,
      newStatus,
      reason
    );

    asset.status = newStatus;
    asset.statusHistory.push({
      status: newStatus,
      changedBy: req.user.email,
      changedAt: new Date(),
      reason,
    });

    await asset.save();

    res.json({
      message: "Asset status updated",
      asset,
      metadata: AssetLifecycle.getStateContext(newStatus),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
```

---

## Warranty Expiry Automation

### Overview
Automated cron job that checks for expiring warranties and sends email notifications.

### Implementation

#### 1. Setup in Server

```javascript
// server.js
const WarrantyExpiryJob = require("./jobs/warrantyExpiryJob");

const warrantyJob = new WarrantyExpiryJob();

// Schedule job to run daily at 09:00
if (process.env.NODE_ENV !== "test") {
  warrantyJob.schedule("0 9 * * *");
  console.log("Warranty expiry job scheduled");
}
```

#### 2. Email Template

```javascript
// Job automatically sends formatted HTML emails with:
// - Asset details (name, serial number, warranty date)
// - Days remaining
// - Action links
// - Color-coded severity levels
```

#### 3. Configuration

```env
# .env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=https://your-domain.com
```

---

## Database Indexing

### Overview
Comprehensive indexing strategy for optimal query performance.

### Implementation

#### 1. Apply Indexes to Models

```javascript
// models/User.js
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });

// models/Asset.js
assetSchema.index({ serialNumber: 1 }, { unique: true });
assetSchema.index({ status: 1 });
assetSchema.index({ assignedTo: 1 });
assetSchema.index({ warrantyExpiry: 1 });
assetSchema.index({ status: 1, assignedTo: 1 });
assetSchema.index({ name: "text", description: "text" });

// models/AuditLog.js
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // TTL
```

#### 2. Monitor Index Usage

```javascript
// Debug route (admin only)
app.get("/api/admin/indexes", async (req, res) => {
  const stats = await Asset.collection.aggregate([{ $indexStats: {} }]).toArray();
  res.json(stats);
});
```

---

## Centralized Logging

### Overview
Winston-based logging with structured JSON format and multiple log levels.

### Implementation

#### 1. Use Logger in Controllers

```javascript
// controllers/assetController.js
const { logger, securityLogger, performanceLogger } = require("../config/logger");

const getAssets = async (req, res) => {
  const start = Date.now();

  try {
    const assets = await Asset.find();
    const duration = Date.now() - start;

    performanceLogger({ operation: "getAssets", duration, threshold: 100 });

    logger.info("Assets retrieved", { count: assets.length, duration });
    res.json(assets);
  } catch (error) {
    logger.error("Failed to get assets", { error: error.message });
    res.status(500).json({ message: error.message });
  }
};
```

#### 2. Security Logging

```javascript
const { securityLogger } = require("../config/logger");

securityLogger({
  event: "login_success",
  userId: user._id,
  email: user.email,
  ip: req.ip,
  status: "success",
});

securityLogger({
  event: "unauthorized_access",
  userId: req.user._id,
  ip: req.ip,
  resource: "assets",
  status: "failure",
});
```

---

## Error Tracking (Sentry)

### Overview
Real-time error monitoring and alerting with Sentry.

### Implementation

#### 1. Backend Setup

```javascript
// server.js
const { initializeSentryBackend, errorHandler } = require("./config/sentry");

initializeSentryBackend(app);

// ... routes ...

errorHandler(app);
```

#### 2. Manual Error Capture

```javascript
const { captureError, captureWarning, setUserContext } = require("../config/sentry");

// On login
setUserContext(user._id, user.email, user.name);

// On error
try {
  // ... code ...
} catch (error) {
  captureError(error, {
    userId: req.user?.id,
    endpoint: req.path,
    method: req.method,
  });
}
```

#### 3. Frontend Setup

```javascript
// frontend/src/main.jsx
import * as Sentry from "@sentry/react";
import { initializeSentryFrontend } from "../config/sentry";

Sentry.init(initializeSentryFrontend());

// Error boundary
import { createErrorBoundary } from "../config/sentry";
const ErrorBoundary = createErrorBoundary();

// Wrap app
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## API Versioning

### Overview
URL-path based API versioning with migration guides.

### Implementation

#### 1. Add Versioning Middleware

```javascript
// routes/assetRoutes.js
const { versionMiddleware } = require("../config/versioning");

router.use(versionMiddleware);

// Handler that routes based on version
const getAssets = require("../config/versioning").routeByVersion({
  "1.0.0": (req, res) => {
    // V1 implementation
  },
  "2.0.0": (req, res) => {
    // V2 implementation with improved format
  },
});
```

#### 2. Use Versioned Endpoints

```javascript
// V1 requests
GET /api/v1/assets?status=active

// V2 requests with improved filtering
GET /api/v2/assets?filter={"status":"active"}&cursor=xxx&limit=10
```

#### 3. Get Deprecation Info

```javascript
// Get version info
GET /api/versions

// Returns:
// {
//   versions: [
//     { version: "1.0.0", status: "stable" },
//     { version: "2.0.0", status: "beta" }
//   ]
// }
```

---

## Docker Deployment

### Overview
Complete containerization with Docker Compose.

### Quick Start

```bash
# Development setup
docker-compose up

# Production setup with monitoring
docker-compose --profile production --profile monitoring up -d

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down
```

### Services Included

- **MongoDB** - Database with authentication
- **Redis** - Caching and session storage
- **Backend** - Node.js API server
- **Frontend** - React application
- **Nginx** - Reverse proxy (production)
- **Prometheus** - Metrics (optional)
- **Grafana** - Dashboards (optional)

### Environment Variables

```env
# .env file
NODE_ENV=production
MONGO_USER=admin
MONGO_PASSWORD=secure-password
JWT_SECRET=your-jwt-secret
REFRESH_SECRET=your-refresh-secret
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

---

## CI/CD Pipeline

### Overview
Automated testing, building, and deployment with GitHub Actions.

### Setup

#### 1. Add Secrets to GitHub

```
Settings → Secrets and Variables → Actions → New repository secret
```

Required secrets:
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`
- `SLACK_WEBHOOK` (optional)
- `SSH_PRIVATE_KEY` (for deployment)

#### 2. Pipeline Workflow

```
Trigger (push/PR)
  ↓
Code Quality Check
  ├→ Linting
  └→ TypeScript/Syntax
  ↓
Run Tests
  ├→ Backend Unit Tests
  ├→ Frontend Unit Tests
  └→ Coverage Reports
  ↓
Security Scan
  ├→ Trivy Vulnerability Scan
  └→ npm audit
  ↓
Build & Push Images
  ├→ Backend Docker Image
  └→ Frontend Docker Image
  ↓
Deploy to Staging/Production
  ├→ Pull latest images
  ├→ Run migrations
  ├→ Health checks
  └→ Notify team
```

#### 3. View Pipeline Status

```
GitHub → Actions tab → See all workflow runs
```

---

## Performance Optimization Tips

### Database Queries
```javascript
// ❌ Bad - N+1 queries
const assets = await Asset.find();
for (const asset of assets) {
  asset.user = await User.findById(asset.assignedTo);
}

// ✅ Good - Populate in one query
const assets = await Asset.find().populate("assignedTo");
```

### Caching with Redis
```javascript
const redis = require("redis");
const client = redis.createClient();

// Cache expensive query
const getAssets = async () => {
  const cached = await client.get("assets:list");
  if (cached) return JSON.parse(cached);

  const assets = await Asset.find();
  await client.setEx("assets:list", 3600, JSON.stringify(assets));
  return assets;
};
```

### API Response Compression
```javascript
const compression = require("compression");
app.use(compression());
```

---

## Monitoring & Alerting

### Health Check Endpoints

```javascript
// Backend health
GET /api/health

// Database health
GET /api/health/db

// Redis health
GET /api/health/cache

// Full system status
GET /api/health/status
```

### Sentry Alerts

- Real-time error notifications
- Syntax errors captured automatically
- User context preserved
- Source maps uploaded
- Release tracking enabled

---

## Next Steps

1. **Update Environment Variables** - Set all required `.env` values
2. **Review Security** - Enable HTTPS, update secrets
3. **Configure Monitoring** - Set up Sentry DSN, Slack webhooks
4. **Test Locally** - Run `docker-compose up` and verify all services
5. **Deploy to Production** - Use CI/CD pipeline for safe deployment
6. **Monitor** - Set up alerts and dashboards
7. **Iterate** - Gather feedback and improve

---

**For detailed API documentation, see [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)**

**For modernization roadmap, see [MODERNIZATION_GUIDE.md](./MODERNIZATION_GUIDE.md)**

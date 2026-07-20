<div align="center">

# 🖥️ IT Asset Tracking System

### Enterprise-Grade IT Asset Management & Security Operations Platform

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**A full-stack MERN application for organizations that need real-time IT asset visibility, lifecycle management, cybersecurity monitoring, and audit-grade accountability — all in one platform.**

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Screenshots](#-screenshots)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Docker Deployment](#-docker-deployment)
- [API Reference](#-api-reference)
- [Security Architecture](#-security-architecture)
- [User Roles & Permissions](#-user-roles--permissions)
- [Quality & Testing](#-quality--testing)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

The **IT Asset Tracking System** is a production-ready platform designed to solve the real operational challenges faced by IT and security teams:

- **Where are all our assets?** — Real-time inventory with live network discovery
- **Who has access to what?** — Role-based access control with 2FA and audit trails
- **Is our infrastructure secure?** — Built-in cybersecurity monitoring, threat detection, and SIEM-ready logging
- **What happened and when?** — Immutable, cryptographically verifiable audit logs
- **What is the health of our endpoints?** — Lightweight agent for live CPU, RAM, and network telemetry

Unlike traditional ITAM tools that are limited to static spreadsheets or siloed databases, this platform integrates **asset lifecycle management**, **security operations**, **endpoint telemetry**, and **network discovery** into a unified, enterprise-grade web interface.

---

## ✨ Key Features

### 🗂️ Asset Inventory & Lifecycle Management
- Full CRUD operations for IT assets with rich metadata (serial number, type, classification, assignment, cost, lifecycle)
- Asset classification levels: Public → Internal → Confidential → Restricted
- Lifecycle phase tracking: Procurement → Active → Maintenance → Retired
- PDF inventory reports with checksums and integrity validation
- CSV export support
- Real-time asset updates via WebSocket (Socket.IO)
- Powerful filter & sort controls (by status, type, date, risk score, lifecycle)

### 🔒 Security & Zero-Trust Controls
- JWT authentication with refresh token rotation
- TOTP-based **Two-Factor Authentication (2FA)** using `speakeasy` + QR code provisioning
- **Step-up re-authentication** for all destructive and privileged admin actions
- Role-Based Access Control (RBAC) with `Employee`, `Admin`, and `Super Admin` tiers
- HMAC validation for endpoint agent reports
- Rate limiting, Helmet security headers, XSS sanitization, NoSQL injection prevention

### 🌐 Network Discovery & Monitoring
- **Manual ARP-based network scan** (`POST /api/assets/scan-network`)
- **Scheduled network discovery** every 5 minutes via background job
- **TCP watchdog ping** every 2 minutes to detect unreachable nodes
- Automatic rogue device detection with alert generation and risk scoring
- Interactive network topology map (D3 + Leaflet) with live asset positions

### 🛡️ Cybersecurity Operations
- Security alert dashboard with severity tagging (Critical / High / Medium / Low)
- Threat detection engine with SIEM-ready Winston structured logs
- Security event correlation and posture scoring
- Real-time alerts via WebSocket for instant SOC visibility

### 📡 Endpoint Telemetry (Agent)
- Separate `endpoint-agent` service deployable on managed devices
- Reports: CPU usage, RAM usage, IP address, MAC address, OS info, hardware fingerprint
- HMAC-authenticated reports for tamper detection
- Telemetry analysis and anomaly flagging through the detection engine

### 📊 Dashboard & Analytics
- Executive dashboard with asset health cards and status breakdown
- Recharts-powered visualizations: asset distribution, status trends, risk scores
- Security posture metrics and threat summary widgets
- Self-service portal for end users (request assets, view assignments)

### 📝 Audit Logs & Compliance
- **Immutable audit log model** — updates and deletes are blocked at the database level
- **Chain hashing** — each log entry links to the previous via hash
- **HMAC signatures** on every audit entry for cryptographic integrity
- Audit integrity verification API (`GET /api/audit/integrity`)
- Full action history: logins, asset changes, user management, security events

### 👤 Identity & Access Management (IAM)
- Admin panel to view, promote, and remove users
- Dual-approval mechanism for high-privilege actions (promotion / termination)
- Activity log per user with action type filtering
- Session management with "Log Out From All Devices" support
- Account registration with multi-step guided flow and password strength meter

### ⚙️ Settings & User Profile
- Profile editing (name, phone, department)
- Password change with inline requirement checker
- Notification preference toggles (email, push, activity, security alerts)
- Privacy & tracking consent controls (location, IP monitoring)
- Encrypted database backup download (Admin/Super Admin only)

### 🚀 DevOps & Deployment
- Fully containerized via **Docker Compose** (MongoDB, Redis, Backend, Frontend, Nginx)
- Optional **Prometheus + Grafana** monitoring stack
- Optional **Nginx** reverse proxy with SSL support
- GitHub Actions CI pipeline for automated quality checks

---

## 🖼️ Screenshots

> *Screenshots are located in the `screenshots/` directory of this repository.*

| Page | Description |
|---|---|
| Dashboard | Executive overview with asset health, charts, and security posture |
| Asset Inventory | Full inventory table with filter, sort, search, and PDF export |
| Asset Modal | Register / edit asset with classification and lifecycle fields |
| Network Map | Interactive D3 + Leaflet topology visualization |
| Cybersecurity | Alert dashboard with severity tagging and threat monitoring |
| Audit Logs | Immutable log viewer with integrity status per entry |
| Settings | Profile, security, preferences, and sessions management |
| Register | Multi-step account registration with password strength meter |
| Login | Enterprise login with 2FA support |

---

## 🏗️ Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework with hooks and context |
| **Vite 8** | Build tool and dev server |
| **Tailwind CSS v4** | Utility-first styling |
| **Framer Motion** | Animations and transitions |
| **Recharts** | Data visualization and charts |
| **D3.js** | Network topology graph |
| **Leaflet / React-Leaflet** | Interactive maps |
| **Socket.IO Client** | Real-time WebSocket updates |
| **Axios** | HTTP client with interceptors |
| **jsPDF + jspdf-autotable** | PDF report generation |
| **React Router v6** | Client-side routing |
| **React Toastify** | Toast notifications |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js 18+** | Runtime environment |
| **Express** | REST API framework |
| **MongoDB 7 + Mongoose** | Primary database + ODM |
| **Redis** | Session caching and rate limiting |
| **Socket.IO** | Real-time bidirectional events |
| **Winston** | Structured SIEM-ready logging |
| **Node Cron** | Background job scheduling |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | JWT access + refresh tokens |
| **speakeasy** | TOTP-based 2FA |
| **Helmet** | HTTP security headers |
| **express-rate-limit** | API rate limiting |
| **express-mongo-sanitize** | NoSQL injection prevention |
| **xss-clean** | XSS sanitization |
| **Resend** | Transactional email delivery |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker + Docker Compose** | Containerization and orchestration |
| **Nginx** | Reverse proxy + SSL termination (production) |
| **Prometheus + Grafana** | Metrics and monitoring (optional) |
| **GitHub Actions** | CI/CD pipeline |

---

## 📁 Project Structure

```
IT-ASSET-TRACKING/
├── backend/                    # Express API server
│   ├── config/                 # Database, Redis, and app configuration
│   ├── controllers/            # Route handler logic
│   ├── jobs/                   # Scheduled background jobs (cron)
│   │   ├── networkDiscoveryJob.js   # ARP scan every 5 min
│   │   └── pingWatchdog.js          # TCP ping every 2 min
│   ├── middleware/             # Auth, RBAC, rate limiting, zero-trust
│   ├── models/                 # Mongoose schemas (Asset, User, AuditLog, Alert)
│   ├── routes/                 # API route definitions
│   ├── services/               # Business logic (detection engine, email, backup)
│   ├── utils/                  # Helpers (HMAC, crypto, formatting)
│   ├── validators/             # Input validation schemas
│   ├── bots/                   # Automated monitoring bots
│   ├── __tests__/              # Jest unit tests
│   ├── .env.example            # Environment variable template
│   └── server.js               # Application entry point
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── UI.jsx              # Button, Input, Badge, Modal, Alert
│   │   │   ├── AssetModal.jsx      # Asset create/edit modal
│   │   │   ├── AssetTable.jsx      # Sortable asset table
│   │   │   ├── AssetNetworkMap.jsx # D3 + Leaflet topology map
│   │   │   ├── AuthShell.jsx       # Auth page layout wrapper
│   │   │   ├── CommandPalette.jsx  # Keyboard-driven command palette
│   │   │   ├── SecurityAlertBanner.jsx # Live security alert banner
│   │   │   └── ...
│   │   ├── pages/              # Route-level page components
│   │   │   ├── Dashboard.jsx       # Executive dashboard
│   │   │   ├── Assets.jsx          # Asset inventory management
│   │   │   ├── Cybersecurity.jsx   # Security operations center
│   │   │   ├── AuditLogs.jsx       # Immutable audit log viewer
│   │   │   ├── Users.jsx           # IAM — user management
│   │   │   ├── Settings.jsx        # Profile, security, preferences
│   │   │   ├── SelfService.jsx     # End-user self-service portal
│   │   │   ├── Lifecycle.jsx       # Asset lifecycle tracking
│   │   │   ├── Login.jsx           # Enterprise login with 2FA
│   │   │   ├── Register.jsx        # Multi-step account registration
│   │   │   └── ...
│   │   ├── context/            # React context (Auth, Theme)
│   │   ├── hooks/              # Custom hooks (useDraftState, etc.)
│   │   ├── services/           # Socket.IO client, API services
│   │   ├── utils/              # Validation, formatting, animations
│   │   ├── config/             # Theme tokens, app config
│   │   ├── modern.css          # Global dark-theme design system
│   │   └── index.css           # Tailwind imports + global overrides
│   └── public/                 # Static assets and background images
│
├── endpoint-agent/             # Lightweight device telemetry agent
├── qa/                         # Quality assurance scripts
│   ├── run-continuity-check.mjs
│   └── run-penetration-lite.mjs
├── docs/                       # Project documentation and reports
├── scripts/                    # Utility and migration scripts
├── docker-compose.yml          # Full-stack container orchestration
├── .github/workflows/ci.yml    # GitHub Actions CI pipeline
├── .gitignore
└── package.json                # Root workspace scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher
- **MongoDB** 7.0 (local or cloud — MongoDB Atlas works)
- **Redis** 7 (optional for caching; backend will fall back gracefully)
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/ragulp-career/it-asset-tracking.git
cd it-asset-tracking
```

### 2. Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in all required values (see [Environment Variables](#-environment-variables) below).

### 3. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Install root workspace tools
cd ..
npm install
```

### 4. Start the Development Servers

**Backend** (runs on `http://localhost:5000`):
```bash
cd backend
npm run dev
```

**Frontend** (runs on `http://localhost:5173`):
```bash
cd frontend
npm run dev
```

### 5. Access the Application

| Service | URL |
|---|---|
| Frontend App | http://localhost:5173 |
| Backend API | http://localhost:5000/api |
| Health Check | http://localhost:5000/api/health |

> **Default admin credentials** are set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your `.env` file. Change these immediately after first login.

---

## 🔐 Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
# ── Server ────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── Database ──────────────────────────────────────────────────────
MONGO_URI=mongodb://localhost:27017/it_asset_tracker
DB_ENCRYPTION_SECRET=your_32_character_encryption_secret_here

# ── Authentication & Security ─────────────────────────────────────
JWT_SECRET=your_strong_jwt_access_secret_here
REFRESH_SECRET=your_strong_jwt_refresh_secret_here
BACKUP_SECRET=your_32_character_backup_encryption_secret_here

# ── Email Delivery (Resend — recommended) ─────────────────────────
RESEND_API_KEY=your_resend_api_key_here

# ── AI Integration (Optional) ─────────────────────────────────────
GEMINI_API_KEY=your_google_gemini_api_key_here

# ── CORS & Client Config ──────────────────────────────────────────
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000

# ── Fallback Email (Gmail) ────────────────────────────────────────
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# ── Bootstrap Admin Account ───────────────────────────────────────
ADMIN_EMAIL=admin@yourorganization.com
ADMIN_PASSWORD=StrongP@ssword123!
```

> ⚠️ **Never commit your `.env` file.** It is already listed in `.gitignore`.

---

## 🐳 Docker Deployment

### Development (All Services)

```bash
docker-compose up
```

### Production (with Nginx reverse proxy)

```bash
docker-compose --profile production up -d
```

### Production + Monitoring (Prometheus + Grafana)

```bash
docker-compose --profile production --profile monitoring up -d
```

### Service Ports

| Service | Port |
|---|---|
| Frontend | 5173 |
| Backend API | 5000 |
| MongoDB | 27017 |
| Redis | 6379 |
| Nginx | 80 / 443 |
| Prometheus | 9090 |
| Grafana | 3000 |

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new account | Public |
| `POST` | `/api/auth/login` | Login and receive JWT | Public |
| `POST` | `/api/auth/logout` | Invalidate refresh token | Auth |
| `POST` | `/api/auth/refresh` | Rotate access token | Refresh Token |
| `POST` | `/api/auth/forgot-password` | Send password reset email | Public |
| `POST` | `/api/auth/reset-password/:token` | Reset password with token | Public |
| `POST` | `/api/auth/change-password` | Change password (authenticated) | Auth |
| `POST` | `/api/auth/check-email` | Check email availability | Public |
| `GET` | `/api/auth/me` | Get current user profile | Auth |
| `PUT` | `/api/auth/profile` | Update profile / preferences | Auth |
| `GET` | `/api/auth/activity` | Get current user's activity log | Auth |

### Assets

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/assets` | List assets (filter, sort, search) | Auth |
| `POST` | `/api/assets` | Register new asset | Admin |
| `PUT` | `/api/assets/:id` | Update asset metadata | Admin |
| `DELETE` | `/api/assets/:id` | Decommission asset (with password) | Admin |
| `POST` | `/api/assets/scan-network` | Trigger ARP network scan | Admin |

### Users (IAM)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/auth/users` | List all users | Admin |
| `PUT` | `/api/auth/users/:id/promote` | Promote user to Admin | Admin + Step-up |
| `DELETE` | `/api/auth/users/:id` | Remove user account | Admin + Step-up |

### Cybersecurity

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/security/alerts` | List security alerts | Auth |
| `PUT` | `/api/security/alerts/:id/resolve` | Resolve an alert | Admin |
| `GET` | `/api/security/posture` | Security posture summary | Auth |

### Audit Logs

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/audit` | List audit log entries | Admin |
| `GET` | `/api/audit/integrity` | Verify chain hash integrity | Admin |

### Health & Maintenance

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/health` | System health check | Public |
| `POST` | `/api/maintenance/backup` | Download encrypted backup | Super Admin |

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                        │
│  React SPA │ JWT in Memory │ Refresh Token in HttpOnly Cookie│
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────▼───────────────────────────────┐
│                    Nginx Reverse Proxy                       │
│            Rate Limiting │ SSL Termination │ CORS            │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Express API Server                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │   Helmet     │  │ Rate Limiter │  │  XSS / NoSQL Clean │ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  JWT Auth    │  │  RBAC Guard  │  │  Zero-Trust MFA    │ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  HMAC Agent  │  │ Audit Logger │                         │
│  │   Verify     │  │ (Immutable)  │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────┬───────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │ MongoDB  │        │  Redis   │        │  Socket  │
   │ (Primary │        │ (Cache / │        │   .IO    │
   │   DB)    │        │  Tokens) │        │ (Events) │
   └──────────┘        └──────────┘        └──────────┘
```

### Security Layers

| Layer | Implementation |
|---|---|
| Transport | HTTPS via Nginx SSL, HSTS headers |
| Authentication | JWT (15 min) + Refresh Token (7 days, HttpOnly cookie) |
| Authorization | RBAC with 3 tiers: Employee / Admin / Super Admin |
| MFA | TOTP via speakeasy, QR code provisioning |
| Step-up Auth | Password re-confirmation for destructive operations |
| Input Validation | Joi schemas + express-validator on all routes |
| Injection Prevention | express-mongo-sanitize + xss-clean |
| Rate Limiting | Per-IP limits on auth and sensitive endpoints |
| Audit Trail | Immutable logs with chain hashes and HMAC signatures |
| Agent Security | HMAC-signed telemetry reports prevent spoofing |

---

## 👥 User Roles & Permissions

| Feature | Employee | Admin | Super Admin |
|---|:---:|:---:|:---:|
| View assets | ✅ | ✅ | ✅ |
| Register / edit assets | ❌ | ✅ | ✅ |
| Delete assets | ❌ | ✅ | ✅ |
| View audit logs | ❌ | ✅ | ✅ |
| View security alerts | ✅ | ✅ | ✅ |
| Resolve security alerts | ❌ | ✅ | ✅ |
| Manage users | ❌ | ✅ | ✅ |
| Promote users | ❌ | ✅ | ✅ |
| Download backup | ❌ | ❌ | ✅ |
| Trigger network scan | ❌ | ✅ | ✅ |
| Self-service portal | ✅ | ✅ | ✅ |

---

## 🧪 Quality & Testing

Run all quality gates from the project root:

```bash
npm install
npm run test:all
```

Individual checks:

```bash
# Backend unit tests (Jest)
npm run test:backend

# Frontend production build verification
npm run test:frontend

# Continuity / integration check
npm run test:continuity

# Lightweight penetration test
npm run test:penetration
```

### What Is Tested

- **Unit tests** — Core utility functions, validation logic, HMAC helpers
- **Integration tests** — API route responses and authentication flows
- **Build check** — Ensures the frontend builds without errors for production
- **Continuity check** — Validates that all critical API endpoints are reachable and responding correctly
- **Penetration lite** — Checks for common vulnerabilities: open redirects, missing rate limits, exposed debug info

---

## 🤝 Contributing

Contributions are welcome. To get started:

1. **Fork** this repository
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Commit your changes**: `git commit -m "feat: add my feature"`
4. **Push the branch**: `git push origin feature/my-feature`
5. **Open a Pull Request** against `main`

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use for |
|---|---|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `docs:` | Documentation updates |
| `style:` | CSS / formatting (no logic change) |
| `refactor:` | Code restructuring |
| `test:` | Test additions or fixes |
| `chore:` | Build tools, dependency updates |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Ragul P**
- GitHub: [@ragulp-career](https://github.com/ragulp-career)
- Email: ragulp.career@gmail.com

---

<div align="center">

**Built with ❤️ for enterprise IT and security teams.**

*Real-time. Secure. Auditable.*

</div>

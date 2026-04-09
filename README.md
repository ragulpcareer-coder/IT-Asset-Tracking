# AssetTrack - Secure IT Asset Tracking Platform

AssetTrack is a MERN-based IT Asset Tracking and security operations platform built for organizations that need more than a static inventory register. It combines asset lifecycle management, role-based access, endpoint telemetry, network discovery, auditability, and SOC-oriented security controls in one system.

## What makes this project different

Many traditional ITAM tools are strong at inventory storage but weak in live security and operational awareness. AssetTrack is designed to close those gaps with code-backed capabilities:

- Continuous network awareness through manual ARP scans plus scheduled discovery and a TCP-based ping watchdog.
- Zero-trust controls for privileged routes with RBAC, 2FA, step-up re-authentication, and device-aware policy checks.
- Built-in cybersecurity integration through alerts, threat telemetry, SIEM-ready Winston logs, and security event correlation.
- Endpoint visibility through a lightweight agent that reports CPU, RAM, network, and host identity telemetry.
- Automated protection workflows including rogue-device alerting, backup jobs, and continuous operational logging.
- Cryptographically verifiable audit logs with immutable write-once behavior and an integrity verification API.

## Verified core capabilities

### Real-time and continuous monitoring

- Manual ARP-based network discovery via `POST /api/assets/scan-network`
- Scheduled network discovery job every 5 minutes via `backend/jobs/networkDiscoveryJob.js`
- TCP watchdog job every 2 minutes via `backend/jobs/pingWatchdog.js`
- Real-time inventory and alert updates with Socket.IO
- Rogue device detection with automatic asset creation, alert generation, and risk scoring

### Zero-trust and security controls

- JWT authentication with refresh-token support
- Mandatory zero-trust middleware on privileged user-management routes
- TOTP-based 2FA using `speakeasy` and QR provisioning
- Step-up re-authentication for destructive or sensitive admin actions
- HMAC validation for endpoint-agent reports
- Input hardening with Helmet, XSS protection, NoSQL sanitization, CSRF support, and rate limiting

### Endpoint telemetry and operational visibility

- Separate `endpoint-agent` service for reporting host telemetry
- CPU, RAM, IP, MAC, hardware fingerprint, and operating-system reporting
- Endpoint telemetry analysis through the detection engine
- Security posture metrics from backend dashboard analytics

### Audit, backup, and recovery

- Immutable audit log model with chain hashing and update/delete blocking
- HMAC signatures added to audit entries for stronger integrity validation
- Audit integrity API at `GET /api/audit/integrity`
- Encrypted local backups plus optional AWS S3 upload
- Scheduled retention and operational jobs for continuity

## Architecture overview

### Frontend

- React 18
- Vite
- Framer Motion
- Recharts
- D3 and Leaflet
- Axios
- jsPDF and `jspdf-autotable`

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- Socket.IO
- Winston
- Node Cron

### Security and reliability

- Helmet
- bcryptjs
- JWT
- Speakeasy
- `express-rate-limit`
- `express-mongo-sanitize`
- `xss-clean`
- HMAC signing and verification helpers

## Main application modules

- Dashboard
- Asset Inventory
- Cybersecurity Monitoring
- Users and IAM
- Audit Logs
- Password Recovery
- Settings
- Endpoint Agent

## Quality status

The current codebase passes the built-in project quality gates:

- Backend tests: pass
- Frontend production build: pass
- Continuity check: pass

Command used:

```bash
npm run test:all
```

## Quick start

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Root quality checks

```bash
npm install
npm run test:all
```

## Report

Project report PDF:

- `docs/IT_Asset_Tracking_Project_Report.pdf`

Regenerate the PDF after documentation updates:

```bash
cd frontend
node ./scripts/generate-project-report.mjs
```

## Current strengths against common ITAM limitations

- Limited real-time awareness: addressed with scheduled discovery, ARP scan, and watchdog jobs
- Weak trust model: addressed with zero-trust route enforcement, HMAC agent auth, RBAC, and 2FA
- No cybersecurity integration: addressed with alerts, threat monitoring, SIEM-ready logs, and security event services
- Poor automation: addressed with background jobs, auto-discovery, automated alerts, and backup scheduling
- Weak endpoint visibility: addressed with the endpoint agent and telemetry ingestion flow
- Weak backup and recovery: addressed with encrypted local snapshots and optional S3 upload
- Weak audit logging: addressed with immutable logs, chain hashes, HMAC signatures, and integrity verification

## License

MIT

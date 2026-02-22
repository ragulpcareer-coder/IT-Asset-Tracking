# 🚀 AssetTrack - Enterprise IT Asset Management

AssetTrack is an advanced, Zero-Trust Architecture web application built with the **MERN stack** (MongoDB, Express, React, Node.js). It is designed to track monetary hardware lifecycles, assign software licenses, securely manage user access with brute-force prevention, and automatically back up your organization's entire infrastructure.

---

## ✨ Enterprise Features

### �️ SOC-Level Cybersecurity (10/10 Enterprise Setup)
- **Active Network Scanner Integration**: Real-time ARP scanning (`local-devices`) natively discovers devices connected to the network automatically without manual entry, transforming this into a Cybersecurity Asset Detection System.
- **Rogue Device Alerts**: Instantly detects and isolates unknown/unauthorized devices on the network, tagging them with High Risk and firing an automated **Email Alert** to the Security Admin (`Nodemailer`).
- **Endpoint Health Agent**: Includes a separate lightweight Node.js agent (`/endpoint-agent`) that can be installed on target machines to securely report CPU/RAM telemetry, active IP/MAC changes, and online status directly back to the main server.
- **Automated Cloud Backup**: Nightly scheduled database snapshots are not just saved locally, but fully integrated to mathematically upload directly to **AWS S3 Cloud Storage** (`@aws-sdk/client-s3`), guarding against server failure.
- **Real-Time Ping Watchdog**: Automated tracking pings every 2 minutes tracking physical device connectivities across the network natively.

### �🔐 Zero-Trust Security & Authentication
- **First-Mover Super Admin Initialization**: The first registered user automatically becomes the Main Admin. All subsequent users are default "Users" requiring promotion.
- **Strict Role-Based Access Control (RBAC)**: Deep Node.js middleware completely silences undocumented/unauthorized API queries.
- **Cryptographic 2FA (Two-Factor Auth)**: Base32 Time-Based One-Time Passwords via Microsoft/Google Authenticator (`speakeasy` & `qrcode`).
- **Auto-Lockout Engine**: 5 consecutive failed logins trigger a 15-minute complete account lockout, logging the IP.
- **Advanced Network Sanitization**: Built-in HTTP compression, XSS query sanitization (`xss-clean`), and NoSQL injection blockades (`express-mongo-sanitize`).
- **Global & Localized Rate Limiting**: DDOS prevention.

### 💻 Infrastructure & Asset Management
- **Hardware Lifecycles**: Calculate financial depreciation directly via `purchase price`, `salvage value`, and `useful life years`.
- **Bulk CSV Uploads**: Instantly drag-and-drop massive Excel/CSV sheets using `react-dropzone` and `csv-parser` to generate thousands of assets simultaneously.
- **Smart QR Code Generation**: Every hardware asset automatically mints its own scannable tracking ID.
- **Software License Tracking**: Keep track of "Adobe" and "Microsoft 365" seats mathematically.
- **Helpdesk Ticketing System**: Internal users can flag broken devices and trigger repair pipelines.
- **Real-Time Synchronizations**: Instant screen updates via WebSockets (`Socket.IO`).

### 📊 Professional Analytics & Export
- **PDF Exec Reports**: Instantly render highly visual PDF documents (`jspdf`, `jspdf-autotable`) of your entire current asset valuation.
- **CSV Data Tunnels**: Bidirectional importing and exporting.
- **Tamper-Proof Audit Logging**: Every system mutation is cryptographically logged forever.

### 🛡️ Automatic Backup & API Keys
- **WebHooks & API Keys**: Generate secure integration keys to plug AssetTrack into Slack or custom CI/CD pipelines.
- **Automated Nightly Backups**: Node.js Cron job generates highly compressed pure JSON database snapshots securely into your local directory every night at 2:00 AM. 

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Framer Motion (Animations), Tailwind CSS, Recharts, jsPDF, Axios.
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.IO, JSONWebToken (JWT). 
- **Security Tools**: bcryptjs, speakeasy (2FA), Helmet, express-rate-limit.

---

## 🚀 Quick Start Guide

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Initialize Admin
- Navigate to `http://localhost:5173`
- Click **Register** and create an account.
- **Note:** The very first account created is permanently locked in as the **Admin**. From the "Users" tab inside the dashboard, the Admin can configure 2FA, generate API Keys, promote other staff, and oversee the entire environment.

---

## 📄 License
MIT License - Free to use for personal or commercial development.

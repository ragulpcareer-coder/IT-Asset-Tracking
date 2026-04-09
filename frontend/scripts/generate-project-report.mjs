import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.join(projectRoot, "docs");
const outputPath = path.join(outputDir, "IT_Asset_Tracking_Project_Report.pdf");

fs.mkdirSync(outputDir, { recursive: true });

const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
});

const colors = {
  navy: [15, 23, 42],
  blue: [37, 99, 235],
  slate: [71, 85, 105],
  light: [241, 245, 249],
  border: [203, 213, 225],
  white: [255, 255, 255],
  green: [22, 163, 74],
};

const page = {
  width: doc.internal.pageSize.getWidth(),
  height: doc.internal.pageSize.getHeight(),
  margin: 18,
  y: 20,
};

function resetY(value = 20) {
  page.y = value;
}

function addPage() {
  doc.addPage();
  resetY();
}

function ensureSpace(heightNeeded) {
  if (page.y + heightNeeded > page.height - page.margin) {
    addPage();
  }
}

function textBlock(text, options = {}) {
  const fontSize = options.fontSize || 11;
  const lineGap = options.lineGap || 5.5;
  const color = options.color || colors.slate;
  const indent = options.indent || 0;
  const width = options.width || page.width - page.margin * 2 - indent;
  const lines = doc.splitTextToSize(text, width);

  doc.setFont("helvetica", options.fontStyle || "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);

  lines.forEach((line) => {
    ensureSpace(lineGap);
    doc.text(line, page.margin + indent, page.y);
    page.y += lineGap;
  });

  page.y += options.after || 1.5;
}

function sectionTitle(title) {
  ensureSpace(14);
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.4);
  doc.line(page.margin, page.y, page.width - page.margin, page.y);
  page.y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...colors.navy);
  doc.text(title, page.margin, page.y);
  page.y += 8;
}

function bulletList(items) {
  items.forEach((item) => {
    ensureSpace(7);
    doc.setFillColor(...colors.blue);
    doc.circle(page.margin + 1.5, page.y - 1.2, 0.8, "F");
    textBlock(item, { indent: 6, after: 0.7 });
  });
  page.y += 1;
}

function keyValueGrid(rows) {
  autoTable(doc, {
    startY: page.y,
    theme: "grid",
    head: [["Item", "Details"]],
    body: rows,
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 3.2,
      textColor: colors.navy,
      lineColor: colors.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: colors.navy,
      textColor: colors.white,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: 122 },
    },
    margin: { left: page.margin, right: page.margin },
  });
  page.y = doc.lastAutoTable.finalY + 8;
}

function addFooter() {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...colors.border);
    doc.line(page.margin, page.height - 12, page.width - page.margin, page.height - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.slate);
    doc.text("AssetTrack Project Report", page.margin, page.height - 7);
    doc.text(`Page ${i} of ${pageCount}`, page.width - page.margin - 20, page.height - 7);
  }
}

function coverPage() {
  doc.setFillColor(...colors.navy);
  doc.rect(0, 0, page.width, 76, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...colors.white);
  doc.text("IT Asset Tracking", page.margin, 30);
  doc.text("Project Report", page.margin, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(220, 230, 245);
  doc.text("Enterprise IT Asset Management and Security Operations Platform", page.margin, 54);

  doc.setFillColor(...colors.light);
  doc.roundedRect(page.margin, 92, page.width - page.margin * 2, 92, 4, 4, "F");

  resetY(108);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...colors.navy);
  doc.text("Executive Summary", page.margin + 6, page.y);
  page.y += 10;

  textBlock(
    "AssetTrack is a MERN-based IT Asset Management platform designed to manage hardware lifecycles, software allocation, user access, audit visibility, and security monitoring in a single integrated system. The platform goes beyond static inventory by combining SOC-oriented controls such as scheduled network discovery, endpoint telemetry, zero-trust route protection, HMAC-authenticated agents, and cryptographically verifiable audit logs.",
    { indent: 6, width: page.width - page.margin * 2 - 12, color: colors.slate }
  );

  page.y += 6;
  keyValueGrid([
    ["Project Name", "AssetTrack - Enterprise IT Asset Management"],
    ["Application Type", "Full-stack web application for asset operations, identity control, and security monitoring"],
    ["Core Stack", "React, Vite, Node.js, Express, MongoDB, Socket.IO"],
    ["Primary Focus", "Inventory visibility, lifecycle management, access control, auditability, and cyber resilience"],
    ["Generated On", new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })],
  ]);
}

coverPage();
addPage();

sectionTitle("1. Project Overview");
textBlock(
  "The system is built to replace spreadsheet-driven asset tracking with a live operational platform. It supports asset registration, assignment, maintenance tracking, software license monitoring, user administration, security incident awareness, and compliance-oriented audit visibility."
);
bulletList([
  "Centralized management of hardware, software, and user-linked asset records.",
  "Role-based access to protect administrative and security workflows.",
  "Real-time updates using Socket.IO for inventory and monitoring views.",
  "Security-first backend with rate limiting, sanitization, encryption, scheduled discovery, and audit integrity verification.",
]);

sectionTitle("2. Problem Statement");
textBlock(
  "Organizations often manage laptops, servers, network devices, licenses, and maintenance history across disconnected tools. That creates weak visibility, inconsistent ownership records, delayed incident response, and avoidable compliance risk. AssetTrack addresses this by consolidating operational and security data into one controlled platform."
);

sectionTitle("3. Objectives");
bulletList([
  "Maintain a single source of truth for asset inventory and status.",
  "Track assignment, depreciation, maintenance, and lifecycle transitions.",
  "Improve account security with 2FA, access policies, and session control.",
  "Provide audit-ready logs for asset and user actions.",
  "Support security monitoring through alerts, events, endpoint telemetry, and continuous network awareness.",
]);

sectionTitle("4. Major Functional Modules");
keyValueGrid([
  ["Dashboard", "Operational overview, KPI cards, charts, and recent audit/security activity."],
  ["Asset Inventory", "Asset CRUD operations, search, filters, QR code support, export, and network map integration."],
  ["Users & IAM", "User onboarding, role control, 2FA workflows, and administrative user management."],
  ["Cybersecurity", "Security monitoring view for alerts, threats, and SOC-style operational visibility."],
  ["Audit Logs", "Recorded actions for traceability, integrity verification, and compliance review."],
  ["Password Recovery", "Forgot/reset password workflow with email delivery support."],
  ["Settings", "Security preferences, account controls, and system configuration options."],
  ["Endpoint Agent", "Lightweight telemetry collector for CPU, RAM, network, and host fingerprint data."],
]);

sectionTitle("5. Backend Architecture");
textBlock(
  "The backend is built with Express and structured around secure REST routes, database-backed models, and real-time event broadcasting. It uses MongoDB through Mongoose and exposes specialized route groups for assets, authentication, dashboard metrics, audit logs, tickets, software licenses, maintenance, and security data."
);
keyValueGrid([
  ["Server Layer", "Express server with HTTP + Socket.IO integration."],
  ["Security Middleware", "Helmet, CORS policy, express-rate-limit, xss-clean, express-mongo-sanitize, cookie-parser, CSRF support."],
  ["Persistence", "MongoDB with models for assets, users, audit logs, incidents, security events, tickets, API keys, and sessions."],
  ["Scheduling", "Cron-based automation for backups, watchdog monitoring, network discovery, retention, and warranty-related tasks."],
  ["Observability", "Winston logging, traffic timing, and audit/event recording."],
]);

addPage();

sectionTitle("6. Frontend Architecture");
textBlock(
  "The frontend is a React 18 application built with Vite. It uses route-based page separation and presents operational views for inventory, users, audit data, dashboard analytics, and cybersecurity. Visual behavior is enhanced with Framer Motion, while charts and reporting are handled with Recharts and jsPDF."
);
bulletList([
  "React Router based navigation with protected and admin-only routes.",
  "Axios for API communication with the backend.",
  "Socket.IO client for real-time updates.",
  "Recharts for KPI and trend visualizations.",
  "D3 and Leaflet libraries available for map and graph views.",
  "Generated PDF and export support for reporting workflows.",
]);

sectionTitle("7. Security Features");
bulletList([
  "JWT-based authentication with refresh token handling.",
  "Two-factor authentication using Speakeasy and QR code enrollment.",
  "Zero-trust enforcement on privileged routes plus step-up re-authentication for sensitive admin actions.",
  "HMAC-authenticated endpoint agent reporting with replay-attack rejection.",
  "Rate limiting on global API traffic, login endpoints, and password reset routes.",
  "Input sanitization for XSS and NoSQL injection defense.",
  "Field-level encryption for sensitive data.",
  "Immutable audit logs with chain hashing, HMAC signatures, and an integrity verification endpoint.",
  "IP blocking and suspicious activity control hooks.",
  "Secure cookie and session-oriented protection model.",
]);

sectionTitle("8. Database Design");
keyValueGrid([
  ["User", "Stores identity, role, login security, and account state."],
  ["Asset", "Stores inventory metadata, assignment, status, lifecycle, QR details, network status, and health telemetry."],
  ["AuditLog", "Stores immutable action history with hash chaining and HMAC signatures for verifiable integrity."],
  ["SecurityEvent / SecurityAlert", "Stores monitoring data for cybersecurity workflows."],
  ["Ticket", "Stores service and repair requests linked to assets or users."],
  ["SoftwareLicense", "Tracks license allocation and software-related asset control."],
  ["PasswordResetToken / RefreshToken / UserSession", "Supports secure authentication lifecycle management."],
]);

sectionTitle("9. Key Workflows");
bulletList([
  "Register asset -> assign metadata -> generate QR -> update operational status.",
  "User login -> optional 2FA verification -> session established -> role-based access enforced.",
  "Asset update or deletion -> backend validation -> audit entry -> real-time UI sync.",
  "Scheduled network discovery -> rogue device identification -> alert pipeline -> real-time asset creation.",
  "Endpoint agent report -> HMAC validation -> telemetry ingestion -> detection engine analysis.",
  "Forgot password request -> token generation -> email dispatch -> reset flow completion.",
  "Security event detection -> alert creation -> dashboard and monitoring views updated.",
]);

sectionTitle("10. Technology Stack");
autoTable(doc, {
  startY: page.y,
  theme: "grid",
  head: [["Layer", "Technologies"]],
  body: [
    ["Frontend", "React 18, Vite, Framer Motion, Recharts, Axios, Leaflet, D3"],
    ["Backend", "Node.js, Express, Socket.IO, JWT, Mongoose"],
    ["Database", "MongoDB"],
    ["Security", "Helmet, Speakeasy, bcryptjs, express-rate-limit, xss-clean, express-mongo-sanitize"],
    ["Reporting", "jsPDF, jspdf-autotable, CSV utilities"],
    ["Automation", "node-cron, AWS S3 SDK, email integrations, scheduled network discovery"],
  ],
  styles: {
    font: "helvetica",
    fontSize: 10,
    cellPadding: 3.2,
    textColor: colors.navy,
    lineColor: colors.border,
    lineWidth: 0.2,
  },
  headStyles: {
    fillColor: colors.navy,
    textColor: colors.white,
    fontStyle: "bold",
  },
  margin: { left: page.margin, right: page.margin },
});
page.y = doc.lastAutoTable.finalY + 8;

sectionTitle("11. Outcomes and Value");
bulletList([
  "Improves visibility of asset ownership, lifecycle, and usage state.",
  "Strengthens security posture by combining ITAM with SOC-style controls and zero-trust enforcement.",
  "Supports compliance through audit history and controlled administration.",
  "Adds continuous discovery and endpoint telemetry beyond what many static ITAM tools provide.",
  "Enables future extension into deeper telemetry, AI analysis, and automated response.",
]);

sectionTitle("12. Validation Status");
bulletList([
  "Backend automated tests passed.",
  "Frontend production build passed.",
  "Continuity checks passed across the current codebase.",
]);

sectionTitle("13. Conclusion");
textBlock(
  "AssetTrack demonstrates how an IT Asset Management platform can evolve beyond inventory storage into a secure operational system. By integrating lifecycle control, user administration, reporting, monitoring, and security workflows, the project provides a practical foundation for enterprise-grade asset governance and future cybersecurity expansion."
);

sectionTitle("14. Future Enhancements");
bulletList([
  "Predictive asset health scoring and hardware replacement recommendations.",
  "Expanded threat intelligence enrichment for suspicious IP and event correlation.",
  "Mobile scanning workflows for on-site asset audits.",
  "Deeper policy automation for onboarding, offboarding, and approval chains.",
  "Enhanced performance optimization and offline-ready field operations.",
]);

addFooter();

const pdfBytes = doc.output("arraybuffer");
fs.writeFileSync(outputPath, Buffer.from(pdfBytes));

console.log(`Project report PDF generated at: ${outputPath}`);

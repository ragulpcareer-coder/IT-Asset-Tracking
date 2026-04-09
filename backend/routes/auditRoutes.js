/**
 * Audit Log Routes — IT Asset Tracking System
 *
 * RBAC Policy (Section 3.5 / 4 of RBAC Policy Document):
 *  - ALL audit log access is ADMIN ONLY.
 *  - Standard users have ZERO access to any log data.
 *  - requireAdmin2FA is enforced on all export operations.
 */

"use strict";

const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const AuditLogSecurity = require("../utils/auditLogSecurity");
const { protect, admin } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");
const { sendError, sendSuccess } = require("../utils/apiResponse");
const validate = require("../middleware/validateRequest");
const {
  dateRangeQuerySchema,
  auditCreateSchema,
  integrityQuerySchema,
} = require("../validators/routeValidators");

// Lightweight CSV generator (no external deps)
function toCSV(rows, fields) {
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    if (s.search(/[,"\n]/) >= 0) return `"${s}"`;
    return s;
  };
  const header = fields.join(",");
  const body = rows.map(r => fields.map(f => escape(r[f])).join(",")).join("\n");
  return header + "\n" + body;
}

// ── GET /api/audit — List logs with pagination & filters (Admin only) ──
router.get("/", protect, admin, validate(dateRangeQuerySchema, "query"), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const { action, from, to } = req.query;
    const q = {};
    if (action) q.action = action;
    if (from || to) q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);

    const logs = await AuditLog.find(q)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await AuditLog.countDocuments(q);
    return sendSuccess(res, 200, "Audit logs fetched successfully", {
      data: logs,
      page,
      limit,
      total,
    });
  } catch (err) {
    return sendError(res, 500, "Failed to fetch audit logs", {
      audit: "fetch_failed",
    });
  }
});

// ── GET /api/audit/export — Export logs as CSV (Admin + 2FA required) ──
router.get("/integrity", protect, admin, requireAdmin2FA, validate(integrityQuerySchema, "query"), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "200", 10), 1000);
    const logs = await AuditLog.find({})
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    const verification = logs.map((log, index) => {
      const expectedSignature = AuditLogSecurity.generateSignature({
        action: log.action,
        performedBy: log.performedBy,
        details: log.details || "",
        ip: log.ip || "",
        resourceId: log.resourceId || null,
        meta: log.meta || null,
        previousHash: log.previousHash || null,
        hash: log.hash || null,
      });

      const signatureValid = expectedSignature === log.signature;
      const previousLog = index > 0 ? logs[index - 1] : null;
      const chainValid = index === 0
        ? log.previousHash === "GENESIS_HASH"
        : previousLog && previousLog.hash === log.previousHash;

      return {
        id: log._id,
        action: log.action,
        createdAt: log.createdAt,
        signatureValid,
        chainValid,
      };
    });

    const invalidEntries = verification.filter((item) => !item.signatureValid || !item.chainValid);

    return sendSuccess(res, 200, "Audit integrity verified successfully", {
      summary: {
        logsChecked: verification.length,
        invalidEntries: invalidEntries.length,
        integrityHealthy: invalidEntries.length === 0,
      },
      invalidEntries,
    });
  } catch (err) {
    return sendError(res, 500, "Failed to verify audit integrity", {
      audit: "integrity_verification_failed",
    });
  }
});

router.get("/export", protect, admin, requireAdmin2FA, validate(dateRangeQuerySchema, "query"), async (req, res) => {
  try {
    const { from, to, action } = req.query;
    const q = {};
    if (action) q.action = action;
    if (from || to) q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);

    const logs = await AuditLog.find(q).sort({ createdAt: -1 }).lean();

    const fields = ["_id", "action", "performedBy", "details", "ip", "resourceId", "createdAt"];
    const prepared = logs.map(l => ({
      _id: l._id,
      action: l.action,
      performedBy: l.performedBy,
      details: l.details || "",
      ip: l.ip || "",
      resourceId: typeof l.resourceId === "object" ? JSON.stringify(l.resourceId) : (l.resourceId || ""),
      createdAt: l.createdAt,
    }));

    const csv = toCSV(prepared, fields);
    res.header("Content-Type", "text/csv");
    res.attachment(`audit-logs-${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    return sendError(res, 500, "Export failed", {
      audit: "export_failed",
    });
  }
});

// ── POST /api/audit — Create a new audit log (Available to all authenticated users) ──
router.post("/", protect, validate(auditCreateSchema), async (req, res) => {
  try {
    const { action, details, resourceId, resourceType, meta } = req.body;

    // SECURITY: Ensure users can't spoof the "performedBy" or "ip" fields
    // These should always come from the authenticated session
    const log = await AuditLog.create({
      action: action || "CLIENT_ACTION",
      performedBy: req.user.email,
      details: details || "Unspecified client-side action",
      ip: req.ip || req.connection?.remoteAddress,
      resourceId,
      resourceType,
      meta: {
        ...meta,
        userAgent: req.get('User-Agent'),
        clientSide: true
      }
    });

    return sendSuccess(res, 201, "Audit event recorded successfully", {
      logId: log._id,
    });
  } catch (err) {
    return sendError(res, 500, "Failed to record audit event", {
      audit: "create_failed",
    });
  }
});

module.exports = router;

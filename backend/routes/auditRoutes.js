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
const { protect, admin } = require("../middleware/authMiddleware");
const { requireAdmin2FA } = require("../middleware/rbacMiddleware");

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
router.get("/", protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, from, to } = req.query;
    const q = {};
    if (action) q.action = action;
    if (from || to) q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);

    const logs = await AuditLog.find(q)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const total = await AuditLog.countDocuments(q);
    res.json({ data: logs, page: parseInt(page, 10), limit: parseInt(limit, 10), total });
  } catch (err) {
    console.error("Audit fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

// ── GET /api/audit/export — Export logs as CSV (Admin + 2FA required) ──
router.get("/export", protect, admin, requireAdmin2FA, async (req, res) => {
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
    console.error("Audit export failed:", err);
    return res.status(500).json({ message: "Export failed" });
  }
});

module.exports = router;

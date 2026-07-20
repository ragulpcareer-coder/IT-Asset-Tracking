import React, { useEffect, useState, useContext, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { socket } from "../services/socket";
// jsPDF and jspdf-autotable are dynamically imported inside
// handleExportPdf (below) instead of statically here — they're a large
// dependency (~428KB) that most dashboard visits never need.
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card, PermissionGuard } from "../components/UI";
import PageHeader from "../components/PageHeader";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, LabelList,
} from "recharts";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Enterprise Command Dashboard
 * KPI Cards: Active Assets | Security Posture | Active Incidents | Audit Events (24h)
 * All metrics derived from real-time DB queries via GET /api/dashboard/metrics.
 */

// ─── Posture score → color mapping ───────────────────────────────────────────
function postureColor(score) {
  if (score >= 80) return { text: "text-emerald-400", bar: "#10b981", label: "Secure" };
  if (score >= 60) return { text: "text-amber-400", bar: "#f59e0b", label: "Moderate Risk" };
  return { text: "text-red-500", bar: "#ef4444", label: "Critical" };
}

// ─── KPI Card skeleton while loading ─────────────────────────────────────────
function KpiSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-white/5 bg-white/5 p-6 h-32" />
  );
}

const DATE_RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

// ─── Individual KPI Card ──────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, icon, loading }) {
  if (loading) return <KpiSkeleton />;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`border-l-4 ${accent} relative overflow-hidden`} style={{ minHeight: 128 }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">
              {label}
            </div>
            <div className="text-4xl font-extrabold text-white tabular-nums leading-none">
              {value}
            </div>
            {sub && (
              <div className="text-slate-500 text-[11px] mt-2 font-medium">{sub}</div>
            )}
          </div>
          <div className="text-2xl opacity-20 select-none">{icon}</div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Security Posture Card (special — shows progress bar) ────────────────────
function PostureCard({ score, meta, loading }) {
  if (loading) return <KpiSkeleton />;
  const { text, bar, label } = postureColor(score);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
    >
      <Card className="border-l-4 border-l-blue-500" style={{ minHeight: 128 }}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">
              Security Posture Score
            </div>
            <div className={`text-4xl font-extrabold tabular-nums leading-none ${text}`}>
              {score ?? "--"}%
            </div>
            <div className={`text-[11px] mt-1 font-bold ${text}`}>{label}</div>
          </div>
          <div className="text-2xl opacity-20 select-none">🛡</div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: bar }}
            initial={{ width: 0 }}
            animate={{ width: `${score ?? 0}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        {meta && (
          <div className="flex gap-3 mt-2 text-[10px] text-slate-500 font-mono">
            <span>Auth {meta.authRate ?? "--"}%</span>
            <span>Patch {meta.patchRate ?? "--"}%</span>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useContext(AuthContext);

  // Metrics from /api/dashboard/metrics
  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState(false);
  const [chartError, setChartError] = useState(false);
  const [dateRange, setDateRange] = useState("30d");

  // Asset + audit log data for charts
  const [assets, setAssets] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [predictiveIntel, setPredictiveIntel] = useState(null);
  const [predictiveIntelError, setPredictiveIntelError] = useState(false);
  const m = metrics || {};
  const safeAssets = useMemo(() => (Array.isArray(assets) ? assets : []), [assets]);
  const safeLogs = useMemo(() => (Array.isArray(logs) ? logs : []), [logs]);

  const fetchMetrics = useCallback(async () => {
    // SECURITY: Only Admins/Super Admins/Auditors should fetch system-wide metrics
    if (!["Super Admin", "Admin", "Security Auditor"].includes(user?.role)) {
      setMetrics({
        activeAssets: { online: 0, total: 0 },
        securityPostureScore: null,
        activeIncidents: 0,
        auditEvents24h: 0,
        _meta: {}
      });
      return;
    }

    try {
      const res = await axios.get("/dashboard/metrics");
      setMetrics(res.data && typeof res.data === "object" ? res.data : {});
      setMetricsError(false);
    } catch (err) {
      // Logic for 403 handling (e.g. if role was changed mid-session)
      if (err.response?.status === 403) {
        setMetricsError(false); // Don't show error banner for expected RBAC block
      } else {
        setMetricsError(true);
      }

      // Fallback to safe zeros so cards don't crash
      setMetrics({
        activeAssets: { online: 0, total: 0 },
        securityPostureScore: 0,
        activeIncidents: 0,
        auditEvents24h: 0,
        _meta: {}
      });
    }
  }, [user?.role]);

  const fetchChartData = useCallback(async () => {
    try {
      const [assetsRes, logsRes] = await Promise.all([
        axios.get("/assets?limit=100&sort=updatedAt:desc"),
        ["Super Admin", "Admin"].includes(user?.role)
          ? axios.get("/audit?limit=100")
          : Promise.resolve({ data: { data: [] } }),
      ]);
      setAssets(Array.isArray(assetsRes.data?.assets) ? assetsRes.data.assets : Array.isArray(assetsRes.data) ? assetsRes.data : []);
      setLogs(Array.isArray(logsRes.data?.data) ? logsRes.data.data : Array.isArray(logsRes.data) ? logsRes.data : []);
      setChartError(false);
    } catch (err) {
      setChartError(true);
      setAssets([]);
      setLogs([]);
      toast.error("Couldn't load chart data. Please try refreshing the page.");
    }
  }, [user?.role]);

  const fetchPredictiveIntel = useCallback(async () => {
    try {
      const res = await axios.get("/dashboard/predictive-intelligence");
      setPredictiveIntel(res.data?.data || null);
      setPredictiveIntelError(false);
    } catch (_err) {
      setPredictiveIntelError(true);
      setPredictiveIntel(null);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchChartData(), fetchPredictiveIntel()]);
      if (isMounted) setLoading(false);
    };
    init();

    socket.on("assetCreated", (a) => {
      if (!a || typeof a !== "object") return;
      setAssets((p) => [a, ...(Array.isArray(p) ? p : [])]);
      fetchMetrics();
    });
    socket.on("assetUpdated", (a) => {
      if (!a?._id) return;
      setAssets((p) => (Array.isArray(p) ? p.map((x) => (x?._id === a._id ? a : x)) : []));
      fetchMetrics();
    });
    socket.on("assetDeleted", (id) => {
      setAssets((p) => (Array.isArray(p) ? p.filter((x) => x?._id !== id) : []));
      fetchMetrics();
    });

    // Refresh metrics every 60 seconds (only if document is visible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMetrics();
    }, 60_000);

    return () => {
      isMounted = false;
      socket.off("assetCreated");
      socket.off("assetUpdated");
      socket.off("assetDeleted");
      clearInterval(interval);
    };
  }, [fetchMetrics, fetchChartData]);

  // Chart data
  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );

  const selectedRangeDays = useMemo(
    () => DATE_RANGE_OPTIONS.find((option) => option.value === dateRange)?.days || 30,
    [dateRange]
  );

  const filteredLogs = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (selectedRangeDays - 1));
    cutoff.setHours(0, 0, 0, 0);
    return safeLogs.filter((log) => {
      const createdAt = new Date(log?.createdAt);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
    });
  }, [safeLogs, selectedRangeDays]);

  const statusData = useMemo(() => {
    const summary = { Active: 0, Maintenance: 0, Retired: 0 };
    for (const asset of safeAssets) {
      if (["available", "assigned"].includes(asset?.status)) summary.Active += 1;
      else if (asset?.status === "maintenance") summary.Maintenance += 1;
      else if (asset?.status === "retired") summary.Retired += 1;
    }
    return [
      { name: "Active", value: summary.Active, color: "#3b82f6" },
      { name: "Maintenance", value: summary.Maintenance, color: "#f59e0b" },
      { name: "Retired", value: summary.Retired, color: "#ef4444" },
    ];
  }, [safeAssets]);

  const auditAreaData = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: browserTimeZone,
    });
    const bucketMap = new Map();

    for (let index = selectedRangeDays - 1; index >= 0; index -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - index);
      date.setHours(0, 0, 0, 0);
      bucketMap.set(date.toISOString().slice(0, 10), {
        name: formatter.format(date),
        events: 0,
      });
    }

    for (const log of filteredLogs) {
      const createdAt = new Date(log?.createdAt);
      if (Number.isNaN(createdAt.getTime())) continue;
      const key = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate())
        .toISOString()
        .slice(0, 10);
      const bucket = bucketMap.get(key);
      if (bucket) bucket.events += 1;
    }

    return Array.from(bucketMap.values());
  }, [filteredLogs, selectedRangeDays, browserTimeZone]);

  const safeStatusData = statusData.some((item) => item.value > 0)
    ? statusData
    : [{ name: "No inventory data", value: 1, color: "#475569" }];
  const safeAuditAreaData = auditAreaData.length > 0
    ? auditAreaData
    : [{ name: "No activity", events: 0 }];

  const handleExportCsv = useCallback(() => {
    const rows = [
      ["Metric", "Value"],
      ["Role", user?.role || "Unknown"],
      ["Time Zone", browserTimeZone],
      ["Date Range", DATE_RANGE_OPTIONS.find((option) => option.value === dateRange)?.label || dateRange],
      ["Active Assets Online", m.activeAssets?.online ?? 0],
      ["Active Assets Total", m.activeAssets?.total ?? 0],
      ["Security Posture Score", m.securityPostureScore ?? 0],
      ["Active Incidents", m.activeIncidents ?? 0],
      ["Audit Events (24h)", m.auditEvents24h ?? 0],
      [],
      ["Inventory Status", "Count"],
      ...safeStatusData.map((item) => [item.name, item.value]),
      [],
      ["Audit Trend", "Events"],
      ...safeAuditAreaData.map((item) => [item.name, item.events]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-summary-${dateRange}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("Dashboard summary exported as CSV.");
  }, [browserTimeZone, dateRange, m.activeAssets?.online, m.activeAssets?.total, m.activeIncidents, m.auditEvents24h, m.securityPostureScore, safeAuditAreaData, safeStatusData, user?.role]);

  const handleExportPdf = useCallback(async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const doc = new jsPDF("landscape");
    doc.setFontSize(18);
    doc.text("IT Asset Tracking Dashboard Summary", 14, 16);
    doc.setFontSize(10);
    doc.text(`Time zone: ${browserTimeZone}`, 14, 24);
    doc.text(`Date range: ${DATE_RANGE_OPTIONS.find((option) => option.value === dateRange)?.label || dateRange}`, 14, 30);

    autoTable(doc, {
      startY: 36,
      head: [["Metric", "Value"]],
      body: [
        ["Active Assets Online", m.activeAssets?.online ?? 0],
        ["Active Assets Total", m.activeAssets?.total ?? 0],
        ["Security Posture Score", m.securityPostureScore ?? 0],
        ["Active Incidents", m.activeIncidents ?? 0],
        ["Audit Events (24h)", m.auditEvents24h ?? 0],
      ],
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Inventory Status", "Count"]],
      body: safeStatusData.map((item) => [item.name, item.value]),
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Audit Trend", "Events"]],
      body: safeAuditAreaData.map((item) => [item.name, item.events]),
    });

    doc.save(`dashboard-summary-${dateRange}.pdf`);
    toast.success("Dashboard summary exported as PDF.");
  }, [browserTimeZone, dateRange, m.activeAssets?.online, m.activeAssets?.total, m.activeIncidents, m.auditEvents24h, m.securityPostureScore, safeAuditAreaData, safeStatusData]);

  return (
    <div className="fade-in pb-12">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* Header */}
      <PageHeader
        title="Security Operations Overview"
        subtitle={`Role: ${user?.role || "Unknown"} | System Status: Operational | Time Zone: ${browserTimeZone}`}
        actions={
          <>
          <label className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-300 sm:w-auto">
            <span className="whitespace-nowrap">Analytics Range</span>
            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
              className="bg-transparent outline-none"
              aria-label="Analytics date range"
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-900">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleExportCsv} className="btn btn-secondary w-full sm:w-auto">Export CSV</button>
          <button type="button" onClick={handleExportPdf} className="btn btn-secondary w-full sm:w-auto">Export PDF</button>
          <Link to="/assets" className="btn btn-secondary w-full sm:w-auto">View Asset Inventory</Link>
          <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
            <Link to="/security" className="btn btn-primary w-full sm:w-auto">Security Monitoring</Link>
          </PermissionGuard>
          </>
        }
      />

      <div className="mb-6" style={{ minHeight: 48 }}>
        {metricsError && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
            ⚠ Warning: metrics endpoint unavailable. Displaying the last known values while connectivity recovers.
          </div>
        )}
        {!metricsError && chartError ? (
          <div className="mt-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-medium">
            Chart detail is partially unavailable. Summary cards are still using the latest successful responses.
          </div>
        ) : null}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {["Super Admin", "Admin", "Security Auditor"].includes(user?.role) ? (
          <>
            {/* 1 — Active Assets */}
            <KpiCard
              label="Active Assets"
              value={`${m.activeAssets?.online ?? 0} / ${m.activeAssets?.total ?? 0}`}
              sub="Endpoints reporting within 5 minutes"
              accent="border-l-blue-500"
              icon="🖥"
              loading={loading}
            />

            {/* 2 — Security Posture Score */}
            <PostureCard
              score={m.securityPostureScore ?? 0}
              meta={m._meta?.posture}
              loading={loading}
            />

            {/* 3 — Active Incidents */}
            <KpiCard
              label="Active Incidents"
              value={m.activeIncidents ?? 0}
              sub="Open / In-Progress tickets"
              accent={
                (m.activeIncidents ?? 0) === 0
                  ? "border-l-emerald-500"
                  : (m.activeIncidents ?? 0) < 5
                    ? "border-l-amber-500"
                    : "border-l-red-500"
              }
              icon="🎫"
              loading={loading}
            />

            {/* 4 — Audit Events 24h */}
            <KpiCard
              label="Audit Events (24h)"
              value={(m.auditEvents24h ?? 0).toLocaleString()}
              sub="Audit log entries in the last 24 hours"
              accent="border-l-purple-500"
              icon="📋"
              loading={loading}
            />
          </>
        ) : (
          <>
            {/* Member KPI View */}
            <KpiCard
              label="My Assigned Assets"
              value={assets.length}
              sub="Nodes currently provisioned to you"
              accent="border-l-emerald-500"
              icon="💻"
              loading={loading}
            />
            <KpiCard
              label="Open Requests"
              value={0} // Placeholder for user tickets
              sub="Support tickets pending resolution"
              accent="border-l-blue-500"
              icon="📥"
              loading={loading}
            />
            <KpiCard
              label="Account Status"
              value={user?.isActive === false ? "Suspended" : "Active"}
              sub="Your account access status"
              accent={user?.isActive === false ? "border-l-red-500" : "border-l-emerald-500"}
              icon="🔐"
              loading={loading}
            />
            <KpiCard
              label="Last Login"
              value={new Date(user?.lastLogin || Date.now()).toLocaleDateString()}
              sub="Session tracking active"
              accent="border-l-purple-500"
              icon="🕒"
              loading={loading}
            />
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-8 mb-10 lg:grid-cols-3">

        {/* Inventory Health Pie */}
        <Card className="lg:col-span-1">
          <h3 className="text-lg font-bold text-white mb-6">Inventory Status</h3>
          <div style={{ height: 300 }} className="relative min-w-0">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={safeStatusData}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={8} dataKey="value"
                >
                  {safeStatusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} strokeWidth={0} />
                  ))}
                  <LabelList dataKey="value" position="outside" fill="#cbd5e1" fontSize={12} />
                </Pie>
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                  itemStyle={{ color: "#fff", fontSize: 12, fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs text-slate-300">
              <caption className="sr-only">Inventory status data table</caption>
              <thead>
                <tr className="text-slate-500">
                  <th className="pb-2 text-left">Status</th>
                  <th className="pb-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {safeStatusData.map((item) => (
                  <tr key={item.name} className="border-t border-white/5">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-right tabular-nums">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Audit Velocity — admin only */}
        <PermissionGuard
          roles={["Super Admin", "Admin"]}
          userRole={user?.role}
          fallback={
            <Card className="lg:col-span-2 flex-center flex-col text-center">
              <div className="text-3xl mb-4">🔒</div>
              <h3 className="font-bold text-slate-100">Audit Data Restricted</h3>
              <p className="text-slate-500 max-w-xs text-sm mt-2">
                Audit telemetry is accessible to Administrator and Super Administrator roles only.
              </p>
            </Card>
          }
        >
          <Card className="lg:col-span-2">
            <h3 className="text-lg font-bold text-white mb-6">Audit Event Frequency</h3>
            <div style={{ height: 300 }} className="relative min-w-0">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
            )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safeAuditAreaData}>
                  <defs>
                    <linearGradient id="auditGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Area
                    type="monotone" dataKey="events"
                    stroke="#3b82f6" fill="url(#auditGrad)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs text-slate-300">
                <caption className="sr-only">Audit event frequency data table</caption>
                <thead>
                  <tr className="text-slate-500">
                    <th className="pb-2 text-left">Day</th>
                    <th className="pb-2 text-right">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {safeAuditAreaData.map((item) => (
                    <tr key={item.name} className="border-t border-white/5">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-right tabular-nums">{item.events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </PermissionGuard>
      </div>

      {/* Security Ledger — admin only */}
      <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
        <Card className="bg-slate-900/50 border-red-500/10 hover:border-red-500/30">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h3 className="font-bold uppercase tracking-widest text-sm">Security Event Log</h3>
            </div>
            <Link to="/audit-logs" className="text-xs font-bold text-blue-500 hover:underline tracking-widest uppercase">
              View Audit Log →
            </Link>
          </div>
          <div className="space-y-4">
            {Array.isArray(filteredLogs) && filteredLogs.slice(0, 3).map((log) => (
              <Link
                key={log._id}
                to="/audit-logs"
                className="flex flex-col justify-between gap-2 rounded-lg border border-white/5 bg-white/5 p-3 transition-colors hover:bg-white/10 md:flex-row md:items-center"
                title="Open full audit log"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex-center text-xs font-bold ${log.action.includes("ALERT") ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                    }`}>
                    {log.action.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{log.action}</div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      Actor: {log.performedBy} / Origin: {log.ip || "INTERNAL"}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {new Date(log.createdAt).toLocaleString(undefined, { timeZone: browserTimeZone })}
                </div>
              </Link>
            ))}
            {filteredLogs.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">No security events recorded yet. Events will appear here as users interact with the system.</p>
            )}
          </div>
        </Card>
      </PermissionGuard>
      {/* Predictive Risk & Lifecycle Intelligence */}
      <PermissionGuard roles={["Super Admin", "Admin", "Manager"]} userRole={user?.role}>
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold uppercase tracking-widest text-sm text-white">Predictive Insights</h3>
              <p className="text-xs text-slate-500 mt-1">
                Rule-based forecasts from your fleet's real data — not a black-box score.
              </p>
            </div>
            <Link to="/assets" className="text-xs font-bold text-blue-500 hover:underline tracking-widest uppercase">
              View Assets →
            </Link>
          </div>

          {predictiveIntelError ? (
            <p className="text-slate-500 text-sm text-center py-4">
              Predictive insights are unavailable right now. Please try refreshing the page.
            </p>
          ) : !predictiveIntel ? (
            <div className="animate-pulse h-24 rounded-lg bg-white/5" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                <div className="text-2xl font-bold text-white">{predictiveIntel.summary.assetsAtRisk}</div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wide mt-1">Assets flagged for review</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                <div className="text-2xl font-bold text-white">{predictiveIntel.summary.licensesNeedingAttention}</div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wide mt-1">Licenses needing attention</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                <div className="text-2xl font-bold text-white">{predictiveIntel.summary.underutilizedAssets}</div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wide mt-1">Idle 30+ days</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                <div className="text-2xl font-bold text-white">{predictiveIntel.summary.assetTypesTracked}</div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wide mt-1">Asset types tracked</div>
              </div>
            </div>
          )}

          {predictiveIntel && predictiveIntel.failureRisks.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Assets to review soon</h4>
              <div className="space-y-2">
                {predictiveIntel.failureRisks.slice(0, 5).map((risk) => (
                  <div key={risk.assetId} className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{risk.name}</span>
                      <span className="text-xs font-mono text-amber-400">{risk.score}/100</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{risk.reasons.join(" ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {predictiveIntel && predictiveIntel.licenseRisks.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Licenses needing attention</h4>
              <div className="space-y-2">
                {predictiveIntel.licenseRisks.map((risk) => (
                  <div key={risk.licenseId} className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{risk.name} ({risk.vendor})</span>
                      <span className="text-xs font-mono text-amber-400">{risk.seatsUsed}/{risk.totalSeats} seats</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{risk.flags.join(" ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {predictiveIntel && predictiveIntel.refreshGuidance.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Refresh timing by asset type</h4>
              <div className="space-y-2">
                {predictiveIntel.refreshGuidance.map((g) => (
                  <div key={g.type} className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{g.type}</span>
                      <span className="text-xs text-slate-500">{g.fleetSize} in fleet</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{g.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </PermissionGuard>
    </div>
  );
}









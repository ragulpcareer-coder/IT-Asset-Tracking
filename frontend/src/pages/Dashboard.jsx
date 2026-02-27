import React, { useEffect, useState, useContext, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { socket } from "../services/socket";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card, PermissionGuard } from "../components/UI";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
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

// ─── Individual KPI Card ──────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, icon, loading }) {
  if (loading) return <KpiSkeleton />;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`border-l-4 ${accent} relative overflow-hidden`}>
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
      <Card className="border-l-4 border-l-blue-500">
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
            <span>2FA {meta.twoFactorRate ?? "--"}%</span>
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

  // Asset + audit log data for charts
  const [assets, setAssets] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await axios.get("/dashboard/metrics");
      setMetrics(res.data);
      setMetricsError(false);
    } catch (err) {
      console.error("[Dashboard] Metrics fetch error:", err.message);
      setMetricsError(true);
      // Fallback to safe zeros so cards don't crash
      setMetrics({
        activeAssets: { online: 0, total: 0 },
        securityPostureScore: 0,
        activeIncidents: 0,
        auditEvents24h: 0,
        _meta: {}
      });
    }
  }, []);

  const fetchChartData = useCallback(async () => {
    try {
      const [assetsRes, logsRes] = await Promise.all([
        axios.get("/assets"),
        ["Super Admin", "Admin"].includes(user?.role)
          ? axios.get("/audit")
          : Promise.resolve({ data: { data: [] } }),
      ]);
      setAssets(assetsRes.data.assets || assetsRes.data || []);
      setLogs(logsRes.data?.data || logsRes.data || []);
    } catch (err) {
      console.error("[Dashboard] Chart data fetch error:", err.message);
      toast.error("Telemetry link degraded. Charts may be incomplete.");
    }
  }, [user?.role]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchChartData()]);
      setLoading(false);
    };
    init();
    socket.connect();

    socket.on("assetCreated", (a) => { setAssets(p => [a, ...p]); fetchMetrics(); });
    socket.on("assetUpdated", (a) => { setAssets(p => p.map(x => x._id === a._id ? a : x)); fetchMetrics(); });
    socket.on("assetDeleted", (id) => { setAssets(p => p.filter(x => x._id !== id)); fetchMetrics(); });

    // Refresh metrics every 60 seconds (only if document is visible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMetrics();
    }, 60_000);

    return () => {
      socket.off("assetCreated");
      socket.off("assetUpdated");
      socket.off("assetDeleted");
      socket.disconnect();
      clearInterval(interval);
    };
  }, [fetchMetrics, fetchChartData]);

  // Chart data
  const statusData = [
    { name: "Active", value: assets.filter(a => ["available", "assigned"].includes(a.status)).length, color: "#3b82f6" },
    { name: "Maintenance", value: assets.filter(a => a.status === "maintenance").length, color: "#f59e0b" },
    { name: "Retired", value: assets.filter(a => a.status === "retired").length, color: "#ef4444" },
  ];

  const auditAreaData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString();
    return {
      name: d.toLocaleDateString(undefined, { weekday: 'short' }),
      events: logs.filter(log => new Date(log.createdAt).toLocaleDateString() === dateStr).length,
    };
  });

  if (loading) return <LoadingSpinner fullScreen message="Syncing Enterprise Telemetry..." />;

  const m = metrics || {};

  return (
    <div className="fade-in pb-12">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tighter">Operations Dashboard</h1>
          <p className="text-slate-500 font-medium mt-1 uppercase text-xs tracking-widest">
            Role: {user?.role} &nbsp;|&nbsp; System Status: Operational
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/assets" className="btn btn-secondary">View Inventory</Link>
          <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
            <Link to="/security" className="btn btn-primary">Security Operations</Link>
          </PermissionGuard>
        </div>
      </div>

      {metricsError && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
          ⚠ Metrics endpoint unavailable — displaying last known values. Verify backend connectivity.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">

        {/* 1 — Active Assets */}
        <KpiCard
          label="Active Assets"
          value={`${m.activeAssets?.online ?? 0} / ${m.activeAssets?.total ?? 0}`}
          sub="Endpoints reporting within 5 minutes"
          accent="border-l-blue-500"
          icon="🖥"
          loading={false}
        />

        {/* 2 — Security Posture Score */}
        <PostureCard
          score={m.securityPostureScore ?? 0}
          meta={m._meta?.posture}
          loading={false}
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
          loading={false}
        />

        {/* 4 — Audit Events 24h */}
        <KpiCard
          label="Audit Events (24h)"
          value={(m.auditEvents24h ?? 0).toLocaleString()}
          sub="Audit log entries in the last 24 hours"
          accent="border-l-purple-500"
          icon="📋"
          loading={false}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">

        {/* Inventory Health Pie */}
        <Card className="lg:col-span-1">
          <h3 className="text-lg font-bold text-white mb-6">Inventory Status</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={8} dataKey="value"
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                  itemStyle={{ color: "#fff", fontSize: 12, fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
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
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={auditAreaData}>
                  <defs>
                    <linearGradient id="auditGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
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
            {logs.slice(0, 3).map((log, i) => (
              <div
                key={log._id || i}
                className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 rounded-lg bg-white/5 border border-white/5"
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
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">No audit events recorded.</p>
            )}
          </div>
        </Card>
      </PermissionGuard>
    </div>
  );
}

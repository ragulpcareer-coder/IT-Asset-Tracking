import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { socket } from "../services/socket";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Badge, Button, Card, ConfirmModal } from "../components/UI";
import { ToastContainer, toast } from "react-toastify";
import AssetNetworkMap from "../components/AssetNetworkMap";

const emptyStats = {
  totalAlerts: 0,
  activeIncidents: 0,
  lockedAccounts: 0,
  blockedIps: 0,
  highRiskUsers: [],
  geoTelemetry: [],
};

const toArray = (value, keyCandidates = []) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const key of keyCandidates) {
    if (Array.isArray(value[key])) return value[key];
  }

  return [];
};

const normalizeStats = (payload) => {
  const source = payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
  return {
    totalAlerts: Number(source.totalAlerts || 0),
    activeIncidents: Number(source.activeIncidents || 0),
    lockedAccounts: Number(source.lockedAccounts || 0),
    blockedIps: Number(source.blockedIps || 0),
    highRiskUsers: Array.isArray(source.highRiskUsers) ? source.highRiskUsers : [],
    geoTelemetry: Array.isArray(source.geoTelemetry) ? source.geoTelemetry : [],
  };
};

const severityToBadge = (severity = "MEDIUM") => {
  const s = String(severity).toUpperCase();
  if (s === "CRITICAL" || s === "HIGH") return "danger";
  if (s === "MEDIUM") return "warning";
  return "success";
};

const mapPointStyle = (lat, lon) => {
  const x = ((Number(lon) + 180) / 360) * 100;
  const y = ((90 - Number(lat)) / 180) * 100;
  return {
    left: `${Math.max(2, Math.min(98, x))}%`,
    top: `${Math.max(2, Math.min(98, y))}%`,
  };
};

export default function Cybersecurity() {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showNetworkMap, setShowNetworkMap] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);

  const [alerts, setAlerts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [threatPoints, setThreatPoints] = useState([]);

  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const canAccess = !!user && ["Super Admin", "Admin", "Security Auditor"].includes(user.role);
  const allowSecurityPush =
    user?.preferences?.pushNotifications !== false &&
    user?.preferences?.securityAlerts !== false;

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);

    const [assetsRes, alertsRes, statsRes, mapRes] = await Promise.allSettled([
      axios.get("/assets?limit=100&sort=riskScore:desc"),
      axios.get("/security/alerts"),
      axios.get("/security/stats"),
      axios.get("/security/threat-map"),
    ]);

    if (assetsRes.status === "fulfilled") {
      const list = toArray(assetsRes.value?.data, ["assets", "data"]);
      setAssets(list);
    } else {
      setAssets([]);
    }

    if (alertsRes.status === "fulfilled") {
      const list = toArray(alertsRes.value?.data, ["alerts", "data"]);
      setAlerts(list);
    } else {
      setAlerts([]);
    }

    if (statsRes.status === "fulfilled") {
      setStats(normalizeStats(statsRes.value?.data));
    } else {
      setStats(emptyStats);
    }

    if (mapRes.status === "fulfilled") {
      const list = toArray(mapRes.value?.data, ["points", "data"]);
      setThreatPoints(list.filter((p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lon))));
    } else {
      setThreatPoints([]);
    }

    setLastUpdated(new Date());
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    if (!canAccess) return;

    fetchData();
    socket.connect();

    const onSecurityAlert = (incoming) => {
      if (!incoming || typeof incoming !== "object") return;

      setAlerts((prev) => {
        const current = Array.isArray(prev) ? prev : [];
        const key = incoming._id || `${incoming.type}-${incoming.sourceIp}-${incoming.createdAt}`;
        const exists = current.some((item) => {
          const itemKey = item._id || `${item.type}-${item.sourceIp}-${item.createdAt}`;
          return itemKey === key;
        });

        if (exists) return current;
        return [incoming, ...current].slice(0, 100);
      });

      if (allowSecurityPush) {
        toast.warn(`${incoming.type || "Security Alert"}: ${incoming.description || "Investigate."}`, {
          toastId: incoming._id || `${incoming.type}-${incoming.sourceIp}-${incoming.createdAt}`,
        });
      }
    };

    socket.on("security_alert", onSecurityAlert);
    const intervalId = setInterval(() => fetchData(true), 30000);

    return () => {
      clearInterval(intervalId);
      socket.off("security_alert", onSecurityAlert);
      if (socket.connected) socket.disconnect();
    };
  }, [canAccess, allowSecurityPush]);

  const topRiskAssets = useMemo(
    () => (Array.isArray(assets) ? assets.slice(0, 10) : []),
    [assets]
  );

  const handleScanNetwork = async () => {
    try {
      setScanning(true);

      let response;
      try {
        response = await axios.post("/assets/scan-network");
      } catch (err) {
        if (err.response?.status === 404) {
          response = await axios.post("/maintenance/scan-network");
        } else {
          throw err;
        }
      }

      toast.success(response?.data?.message || "Network scan completed.");
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Network scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const handleAnalyzeAlert = async (alert) => {
    if (!alert?._id) return;

    setAnalyzingId(alert._id);
    try {
      const { data } = await axios.post(`/security/alerts/${alert._id}/analyze`);
      const analysis = data?.analysis;

      if (analysis) {
        setAlerts((prev) => prev.map((item) => (item._id === alert._id ? { ...item, aiAnalysis: analysis } : item)));
        setSelectedAlert((prev) => (prev?._id === alert._id ? { ...prev, aiAnalysis: analysis } : prev));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "AI analysis failed.");
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleOpenAlert = async (alert) => {
    setSelectedAlert(alert);
    setSelectedIncident(null);

    if (!alert?.incidentId) return;

    try {
      const { data } = await axios.get(`/security/incidents/${alert.incidentId}`);
      setSelectedIncident(data?.incident || data?.data || null);
    } catch {
      setSelectedIncident(null);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex-center min-h-[60vh] flex-col text-center card bg-slate-900/50 border-red-500/20">
        <h2 className="text-2xl font-black text-white px-2">Access Denied</h2>
        <p className="text-slate-500 max-w-md mt-4 px-4 text-sm font-medium">
          Security Monitoring is restricted to Admin and Security Auditor roles.
        </p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner message="Loading security monitoring data..." />;
  }

  return (
    <div className="fade-in pb-10">
      <ToastContainer position="top-right" autoClose={3500} theme="dark" />

      {showNetworkMap && <AssetNetworkMap onClose={() => setShowNetworkMap(false)} />}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tighter uppercase">Security Threat Monitoring</h1>
          <p className="text-slate-500 text-xs uppercase tracking-widest">
            Real-time SOC telemetry and incident intelligence
            {lastUpdated ? ` • Updated ${lastUpdated.toLocaleTimeString()}` : ""}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowNetworkMap(true)}>Open Network Map</Button>
          <Button variant="danger" onClick={handleScanNetwork} loading={scanning}>
            {scanning ? "Scanning..." : "Scan Network for Threats"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 border-white/10 bg-slate-900/40">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Active Incidents</div>
          <div className="text-2xl font-black text-white mt-1">{stats.activeIncidents}</div>
        </Card>
        <Card className="p-4 border-white/10 bg-slate-900/40">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Total Alerts</div>
          <div className="text-2xl font-black text-cyan-400 mt-1">{stats.totalAlerts}</div>
        </Card>
        <Card className="p-4 border-white/10 bg-slate-900/40">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Locked Accounts</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.lockedAccounts}</div>
        </Card>
        <Card className="p-4 border-white/10 bg-slate-900/40">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Blocked IPs</div>
          <div className="text-2xl font-black text-red-400 mt-1">{stats.blockedIps}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 p-0 overflow-hidden border-white/10 bg-slate-900/40">
          <div className="p-4 border-b border-white/10">
            <div className="text-sm text-white font-bold uppercase">Live Threat Map (24h)</div>
            <div className="text-xs text-slate-500">Geographic attack vectors</div>
          </div>
          <div className="relative h-[360px] bg-[#0b1220] overflow-hidden">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(to right, rgba(148,163,184,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.15) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(6,182,212,0.18),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(239,68,68,0.16),transparent_40%)]" />
            {threatPoints.map((point) => (
              <div
                key={point.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={mapPointStyle(point.lat, point.lon)}
                title={`${point.type} (${point.ip || "unknown"}) • ${point.ipType || "UNKNOWN"}`}
              >
                <span className={`block w-3 h-3 rounded-full shadow-lg ${String(point.severity).toUpperCase() === "CRITICAL" ? "bg-red-500 shadow-red-500/40" : "bg-amber-400 shadow-amber-400/40"}`} />
                <span className={`absolute inset-0 rounded-full animate-ping ${String(point.severity).toUpperCase() === "CRITICAL" ? "bg-red-500/30" : "bg-amber-400/30"}`} />
              </div>
            ))}

            {threatPoints.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                No geolocated threats in the last 24 hours.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 border-white/10 bg-slate-900/40">
          <div className="text-sm text-white font-bold uppercase mb-3">Country Distribution</div>
          <div className="space-y-2">
            {stats.geoTelemetry.length === 0 && <p className="text-slate-500 text-xs">No country telemetry available.</p>}
            {stats.geoTelemetry.map((row) => (
              <div key={`${row._id}-${row.count}`} className="flex justify-between text-xs">
                <span className="text-slate-300">{row._id}</span>
                <span className="text-cyan-400 font-bold">{row.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden border-white/10 bg-slate-900/40 mb-8">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-sm text-white font-bold uppercase">Unified Threat Feed</div>
            <div className="text-xs text-slate-500">Live alerts with AI analysis support</div>
          </div>
          <Badge variant="danger">Live</Badge>
        </div>

        <div className="table-container border-none rounded-none">
          <table className="table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Type</th>
                <th>Source</th>
                <th>IP Type</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">No active alerts.</td>
                </tr>
              )}

              {alerts.map((alert) => (
                <tr key={alert._id || `${alert.type}-${alert.sourceIp}-${alert.createdAt}`} className="hover:bg-white/5">
                  <td><Badge variant={severityToBadge(alert.severity)}>{alert.severity || "MEDIUM"}</Badge></td>
                  <td className="text-xs font-bold text-white">{alert.type || "UNKNOWN"}</td>
                  <td>
                    <div className="text-[11px] text-slate-300 font-mono">{alert.sourceIp || "Unknown"}</div>
                    <div className="text-[10px] text-slate-500">{alert.userId?.email || "System"}</div>
                  </td>
                  <td className="text-[10px] text-slate-400">{alert?.metadata?.ipType || "UNKNOWN"}</td>
                  <td className="text-xs text-slate-400 max-w-[360px] truncate">{alert.description || "No details"}</td>
                  <td>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenAlert(alert)}>Open</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleAnalyzeAlert(alert)} loading={analyzingId === alert._id}>Analyze</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border-white/10 bg-slate-900/40">
        <div className="p-4 border-b border-white/10">
          <div className="text-sm text-white font-bold uppercase">Top Risk Assets</div>
          <div className="text-xs text-slate-500">Assets sorted by risk score</div>
        </div>

        <div className="table-container border-none rounded-none">
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>IP</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {topRiskAssets.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">No assets available.</td>
                </tr>
              )}
              {topRiskAssets.map((asset) => (
                <tr key={asset._id}>
                  <td className="text-xs text-white font-bold">{asset.name || "Unnamed"}</td>
                  <td className="text-xs text-slate-400 font-mono">{asset.ipAddress || "N/A"}</td>
                  <td className="text-xs text-slate-300">{Number(asset.riskScore || 0)}%</td>
                  <td><Badge variant={severityToBadge(asset?.securityStatus?.riskLevel)}>{asset?.securityStatus?.riskLevel || "Low"}</Badge></td>
                  <td className="text-xs text-slate-400">{asset.status || "available"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmModal
        isOpen={!!selectedAlert}
        onClose={() => {
          setSelectedAlert(null);
          setSelectedIncident(null);
        }}
        title={selectedAlert?.type || "Alert Details"}
        confirmText="Close"
        type="primary"
        onConfirm={() => {
          setSelectedAlert(null);
          setSelectedIncident(null);
        }}
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div>
            <div className="text-slate-500 uppercase mb-1">Description</div>
            <div>{selectedAlert?.description || "No description"}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-slate-500 uppercase mb-1">Source IP</div>
              <div className="font-mono">{selectedAlert?.sourceIp || "Unknown"}</div>
              <div className="text-[10px] text-slate-500 mt-1">Type: {selectedAlert?.metadata?.ipType || "UNKNOWN"}</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase mb-1">Severity</div>
              <Badge variant={severityToBadge(selectedAlert?.severity)}>{selectedAlert?.severity || "MEDIUM"}</Badge>
            </div>
          </div>

          {selectedIncident && (
            <div>
              <div className="text-slate-500 uppercase mb-2">Incident Timeline</div>
              <div className="space-y-2 max-h-44 overflow-y-auto border border-white/10 rounded p-3 bg-slate-950/50">
                {(Array.isArray(selectedIncident.timeline) ? selectedIncident.timeline : []).map((item, index) => (
                  <div key={`${item.event}-${index}`}>
                    <div className="text-white font-semibold">{item.event}</div>
                    <div className="text-slate-400">{item.details}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedAlert?.aiAnalysis && (
            <div>
              <div className="text-slate-500 uppercase mb-1">AI Analysis</div>
              <div className="space-y-2 border border-cyan-500/30 rounded p-3 bg-cyan-500/5">
                <div className="text-slate-200">{selectedAlert.aiAnalysis.explanation}</div>
                <div className="text-cyan-300 font-semibold">Recommendation: {selectedAlert.aiAnalysis.recommendation}</div>
              </div>
            </div>
          )}
        </div>
      </ConfirmModal>
    </div>
  );
}

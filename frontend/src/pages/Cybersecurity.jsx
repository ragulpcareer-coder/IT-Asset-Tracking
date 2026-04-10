import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { socket } from "../services/socket";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Badge, Button, Card, ConfirmModal } from "../components/UI";
import { ToastContainer, toast } from "react-toastify";
import AssetNetworkMap from "../components/AssetNetworkMap";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import PageHeader from "../components/PageHeader";

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
  const [timelineHours, setTimelineHours] = useState(24);
  const [maskedOnly, setMaskedOnly] = useState(false);
  const [minSeverity, setMinSeverity] = useState("ALL");

  const canAccess = !!user && ["Super Admin", "Admin", "Security Auditor"].includes(user.role);
  const allowSecurityPush =
    user?.preferences?.pushNotifications !== false &&
    user?.preferences?.securityAlerts !== false;

  const fetchData = useCallback(async (silent = false, options = {}) => {
    const { isMountedRef } = options;
    if (!silent) setLoading(true);

    const [assetsRes, alertsRes, statsRes, mapRes] = await Promise.allSettled([
      axios.get("/assets?limit=100&sort=riskScore:desc"),
      axios.get("/security/alerts"),
      axios.get("/security/stats"),
      axios.get("/security/threat-map"),
    ]);

    if (isMountedRef && !isMountedRef.current) return;

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

    const failedCount = [assetsRes, alertsRes, statsRes, mapRes].filter((result) => result.status === "rejected").length;
    if (failedCount === 4 && !silent) {
      toast.error("Security telemetry is temporarily unavailable.");
    } else if (failedCount > 0 && !silent) {
      toast.warn("Some cybersecurity panels are showing partial data.");
    }

    setLastUpdated(new Date());
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    if (!canAccess) return;
    const isMountedRef = { current: true };

    fetchData(false, { isMountedRef });
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
    const intervalId = setInterval(() => fetchData(true, { isMountedRef }), 30000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      socket.off("security_alert", onSecurityAlert);
      if (socket.connected) socket.disconnect();
    };
  }, [canAccess, allowSecurityPush, fetchData]);

  const topRiskAssets = useMemo(
    () => (Array.isArray(assets) ? assets.slice(0, 10) : []),
    [assets]
  );

  const filteredThreatPoints = useMemo(() => {
    const windowMs = Math.max(1, Number(timelineHours) || 24) * 60 * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    return threatPoints.filter((p) => {
      const ts = new Date(p.time || p.createdAt || Date.now()).getTime();
      if (ts < cutoff) return false;
      if (maskedOnly && !p.maskedVector) return false;
      if (minSeverity !== "ALL") {
        const level = String(p.severity || "").toUpperCase();
        const order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
        if (order.indexOf(level) < order.indexOf(minSeverity)) return false;
      }
      return true;
    });
  }, [threatPoints, timelineHours, maskedOnly, minSeverity]);

  const countryDistribution = useMemo(() => {
    const map = {};
    filteredThreatPoints.forEach((p) => {
      const key = p.country || "Unknown";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredThreatPoints]);

  const incidentTicker = useMemo(() => {
    const list = Array.isArray(alerts) ? alerts.slice(0, 8) : [];
    return list.map((a) => ({
      id: a._id || `${a.type}-${a.createdAt}`,
      text: `${new Date(a.createdAt || Date.now()).toLocaleTimeString()} — [${a.type || "Alert"}] ${a.description || a.issue || "Investigate"}`
    }));
  }, [alerts]);

  const maskedCount = useMemo(
    () => filteredThreatPoints.filter((p) => p.maskedVector).length,
    [filteredThreatPoints]
  );

  const avgCertainty = useMemo(() => {
    if (filteredThreatPoints.length === 0) return 0;
    const sum = filteredThreatPoints.reduce((acc, p) => acc + (Number(p.certaintyScore) || 0), 0);
    return Math.round(sum / filteredThreatPoints.length);
  }, [filteredThreatPoints]);

  const attackTypeStats = useMemo(() => {
    const map = {};
    (Array.isArray(alerts) ? alerts : []).forEach((a) => {
      const key = a.type || "Unknown";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [alerts]);

  const criticalIncidents = useMemo(() => {
    return (Array.isArray(alerts) ? alerts : [])
      .filter((a) => ["CRITICAL", "HIGH"].includes(String(a.severity || "").toUpperCase()))
      .slice(0, 4);
  }, [alerts]);

  // Protected network zone marker (can be replaced with org-specific coordinates from backend config)
  const defenseHub = useMemo(() => [13.0827, 80.2707], []); // Chennai

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
    } catch (error) {
      setSelectedIncident(null);
      toast.error(error?.response?.data?.message || "We couldn't load the linked incident details.");
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

            <PageHeader
        title="Security Threat Monitoring"
        subtitle={`Real-time SOC telemetry and incident intelligence${lastUpdated ? ` - Updated ${lastUpdated.toLocaleTimeString()}` : ""}`}
        actions={<>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setShowNetworkMap(true)}>Open Network Map</Button>
          <Button variant="danger" className="w-full sm:w-auto" onClick={handleScanNetwork} loading={scanning}>
            {scanning ? "Scanning..." : "Scan Network for Threats"}
          </Button>
        </>}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-[10px] uppercase tracking-widest text-slate-400">Time Window</label>
              <input
                type="range"
                min="1"
                max="24"
                value={timelineHours}
                onChange={(e) => setTimelineHours(Number(e.target.value))}
                className="w-40"
              />
              <span className="text-xs text-slate-300">Last {timelineHours}h</span>
              <span className="text-[10px] text-slate-500">Attacks: {filteredThreatPoints.length}</span>
              <span className="text-[10px] text-slate-500">Masked: {maskedCount}</span>
              <span className="text-[10px] text-slate-500">Avg Certainty: {avgCertainty}%</span>
              <label className="text-[10px] uppercase tracking-widest text-slate-400">Severity</label>
              <select
                className="input h-8 bg-slate-950/40 border-white/10 text-[10px]"
                value={minSeverity}
                onChange={(e) => setMinSeverity(e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="LOW">Low+</option>
                <option value="MEDIUM">Medium+</option>
                <option value="HIGH">High+</option>
                <option value="CRITICAL">Critical</option>
              </select>
              <label className="text-[10px] uppercase tracking-widest text-slate-400">Masked Only</label>
              <input
                type="checkbox"
                className="accent-cyan-500"
                checked={maskedOnly}
                onChange={(e) => setMaskedOnly(e.target.checked)}
              />
            </div>
          </div>
          <div className="h-[380px]">
            {filteredThreatPoints.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-[#0b1220]">
                No geolocated threats in the last 24 hours.
              </div>
            ) : (
              <MapContainer
                center={[20, 0]}
                zoom={2}
                minZoom={2}
                maxZoom={10}
                style={{ height: "100%", width: "100%", background: "#0b1220" }}
                scrollWheelZoom
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                />
                <Marker position={defenseHub}>
                  <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                    Protected Network Zone
                  </Tooltip>
                </Marker>
                {filteredThreatPoints.map((point) => {
                  const critical = String(point.severity).toUpperCase() === "CRITICAL";
                  const sourcePosition = [Number(point.lat), Number(point.lon)];
                  const targetPosition =
                    Number.isFinite(Number(point.targetLat)) && Number.isFinite(Number(point.targetLon))
                      ? [Number(point.targetLat), Number(point.targetLon)]
                      : defenseHub;
                  const certainty = Number.isFinite(Number(point.certaintyScore))
                    ? Math.max(0.25, Math.min(1, Number(point.certaintyScore) / 100))
                    : 0.65;
                  return (
                    <React.Fragment key={point.id}>
                      <Polyline
                        positions={[sourcePosition, targetPosition]}
                        pathOptions={{
                          color: critical ? "#ef4444" : "#f59e0b",
                          weight: critical ? 3 : 2,
                          opacity: certainty
                        }}
                      />
                      <CircleMarker
                        center={sourcePosition}
                        radius={critical ? 8 : 6}
                        pathOptions={{
                          color: critical ? "#ef4444" : "#f59e0b",
                          fillColor: critical ? "#ef4444" : "#f59e0b",
                          fillOpacity: 0.75
                        }}
                      >
                        <Popup>
                          <div style={{ minWidth: 240 }}>
                            <div><strong>{point.type}</strong></div>
                            <div>IP: {point.ip || "Unknown"}</div>
                            <div>IP Type: {point.ipType || "UNKNOWN"}</div>
                            <div>Country: {point.country || "Unknown"}</div>
                            <div>ASN: {point.asn || "Unknown"}</div>
                            <div>ISP: {point.isp || point.org || "Unknown"}</div>
                            <div>Abuse Score: {Number.isFinite(Number(point.abuseScore)) ? Number(point.abuseScore) : 0}/100</div>
                            <div>Severity: {point.severity || "MEDIUM"}</div>
                            <div>Certainty: {Number.isFinite(Number(point.certaintyScore)) ? Number(point.certaintyScore) : 0}%</div>
                            <div>Vector: {point.maskedVector ? "Masked (VPN/Cloud)" : "Direct"}</div>
                            <div>Target: {point.targetLabel || "Protected Zone"}</div>
                          </div>
                        </Popup>
                      </CircleMarker>
                      <CircleMarker
                        center={targetPosition}
                        radius={4}
                        pathOptions={{
                          color: "#22d3ee",
                          fillColor: "#22d3ee",
                          fillOpacity: 0.7
                        }}
                      />
                    </React.Fragment>
                  );
                })}
              </MapContainer>
            )}
          </div>
          <div className="border-t border-white/10 bg-slate-950/40 px-4 py-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Incident Ticker</div>
            <div className="flex gap-3 overflow-x-auto text-[11px] text-slate-300">
              {incidentTicker.length === 0 && <span className="text-slate-500">No recent incidents.</span>}
              {incidentTicker.map((item) => (
                <span key={item.id} className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1 bg-slate-900/60">
                  {item.text}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4 border-white/10 bg-slate-900/40">
          <div className="text-sm text-white font-bold uppercase mb-3">Country Distribution</div>
          <div className="space-y-2">
            {countryDistribution.length === 0 && <p className="text-slate-500 text-xs">No country telemetry available.</p>}
            {countryDistribution.map(([label, count]) => (
              <div key={`${label}-${count}`} className="flex justify-between text-xs">
                <span className="text-slate-300">{label}</span>
                <span className="text-cyan-400 font-bold">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-white/10 pt-4">
            <div className="text-sm text-white font-bold uppercase mb-3">Attack Types</div>
            <div className="space-y-2">
              {attackTypeStats.length === 0 && <p className="text-slate-500 text-xs">No attack telemetry available.</p>}
              {attackTypeStats.map(([label, count]) => (
                <div key={`${label}-${count}`} className="flex justify-between text-xs">
                  <span className="text-slate-300">{label}</span>
                  <span className="text-amber-400 font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {criticalIncidents.length === 0 && (
          <Card className="p-4 border-white/10 bg-slate-900/40">
            <div className="text-xs uppercase tracking-widest text-slate-500">Critical Incidents</div>
            <div className="text-sm text-slate-400 mt-2">No high severity incidents.</div>
          </Card>
        )}
        {criticalIncidents.map((alert) => (
          <Card key={alert._id || `${alert.type}-${alert.createdAt}`} className="p-4 border-red-500/20 bg-red-500/5">
            <div className="text-xs uppercase tracking-widest text-red-300 mb-2">{alert.severity || "HIGH"}</div>
            <div className="text-sm font-bold text-white">{alert.type || "Security Alert"}</div>
            <div className="text-[11px] text-slate-400 mt-1">{alert.description || "Investigate for details."}</div>
            <div className="text-[10px] text-slate-500 mt-2 font-mono">{alert.sourceIp || "Unknown IP"}</div>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden border-white/10 bg-slate-900/40 mb-8">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
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
                <th>Abuse Score</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">No active alerts.</td>
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
                  <td className="text-[10px] text-slate-300">{Number.isFinite(Number(alert?.metadata?.abuseScore)) ? Number(alert.metadata.abuseScore) : 0}/100</td>
                  <td className="text-xs text-slate-400 max-w-[360px] truncate">{alert.description || "No details"}</td>
                  <td>
                    <div className="flex flex-col gap-2 sm:flex-row">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-slate-500 uppercase mb-1">Source IP</div>
              <div className="font-mono">{selectedAlert?.sourceIp || "Unknown"}</div>
              <div className="text-[10px] text-slate-500 mt-1">Type: {selectedAlert?.metadata?.ipType || "UNKNOWN"}</div>
              <div className="text-[10px] text-slate-500 mt-1">ASN: {selectedAlert?.metadata?.asn || "Unknown"}</div>
              <div className="text-[10px] text-slate-500 mt-1">ISP: {selectedAlert?.metadata?.isp || selectedAlert?.metadata?.org || "Unknown"}</div>
              <div className="text-[10px] text-slate-500 mt-1">Abuse Score: {Number.isFinite(Number(selectedAlert?.metadata?.abuseScore)) ? Number(selectedAlert.metadata.abuseScore) : 0}/100</div>
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



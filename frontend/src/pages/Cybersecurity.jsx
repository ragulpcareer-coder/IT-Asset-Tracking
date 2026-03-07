import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { socket } from "../services/socket";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Button, Card, Badge, ConfirmModal } from "../components/UI";
import { ToastContainer, toast } from "react-toastify";

/**
 * Enterprise Cybersecurity SOC Tracker - Elite Edition
 * Features: Asset Risk Scoring, Threat Intel, SOAR Thresholds, Incident Timelines.
 */
function Cybersecurity() {
    const { user } = useContext(AuthContext);
    const [assetAlerts, setAssetAlerts] = useState([]);
    const [securityAlerts, setSecurityAlerts] = useState([]);
    const [socStats, setSocStats] = useState({ totalAlerts: 0, activeIncidents: 0, lockedAccounts: 0, blockedIps: 0 });
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [simulating, setSimulating] = useState(false);
    const [analyzingId, setAnalyzingId] = useState(null);
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [selectedIncident, setSelectedIncident] = useState(null);

    useEffect(() => {
        fetchData();
        socket.connect();

        socket.on("security_alert", (newAlert) => {
            setSecurityAlerts(prev => [newAlert, ...prev].slice(0, 50));
            fetchStats(); // Update stats on new alert
            toast.error(`🚨 ${newAlert.type}: ${newAlert.description}`, {
                position: "bottom-right",
                autoClose: 10000
            });
        });

        socket.on("security_event", (event) => {
            toast.warn(`🛡️ SOAR Action: ${event.message}`);
            fetchStats();
        });

        return () => {
            socket.off("security_alert");
            socket.off("security_event");
            if (socket.connected) socket.disconnect();
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [assetsRes, securityRes, statsRes] = await Promise.all([
                axios.get(`/assets/security-alerts`),
                axios.get(`/security/alerts`),
                axios.get(`/security/stats`)
            ]);
            setAssetAlerts(assetsRes.data.data || []);
            setSecurityAlerts(securityRes.data || []);
            setSocStats(statsRes.data);
        } catch (err) {
            console.error("Failed to fetch SOC data:", err);
            toast.error("Telemetry failure: Could not reach SOC backend.");
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const { data } = await axios.get(`/security/stats`);
            setSocStats(data);
        } catch (err) {
            console.log("Stats fetch failed");
        }
    };

    const handleSimulateAttack = async (type) => {
        setSimulating(true);
        try {
            const body = type === 'brute-force' ? { email: user.email } : {};
            await axios.post(`/security/simulate/${type}`, body);
            toast.success(`Simulation ${type.replace('-', ' ')} successfully triggered.`);
            setTimeout(fetchData, 1500);
        } catch (err) {
            toast.error("Simulation failed to initialize.");
        } finally {
            setSimulating(false);
        }
    };

    const handleViewIncident = async (incidentId) => {
        if (!incidentId) return;
        try {
            const { data } = await axios.get(`/security/incidents/${incidentId}`);
            setSelectedIncident(data);
        } catch (err) {
            toast.error("Failed to fetch incident details.");
        }
    };

    const handleAIAnalyze = async (alertId) => {
        setAnalyzingId(alertId);
        try {
            const { data } = await axios.post(`/security/alerts/${alertId}/analyze`);
            if (data.success) {
                setSecurityAlerts(prev => prev.map(a => a._id === alertId ? { ...a, aiAnalysis: data.analysis } : a));
                if (selectedAlert && selectedAlert._id === alertId) {
                    setSelectedAlert({ ...selectedAlert, aiAnalysis: data.analysis });
                }
            }
        } catch (err) {
            toast.error("AI Analysis failed. Check Gemini API configuration.");
        } finally {
            setAnalyzingId(null);
        }
    };

    if (!user || !["Super Admin", "Admin", "Security Auditor"].includes(user.role)) {
        return (
            <div className="flex-center min-h-[60vh] flex-col text-center card bg-slate-900/50 border-red-500/20">
                <div className="text-5xl mb-6">🔒</div>
                <h2 className="text-2xl font-black text-white px-2">Access Denied</h2>
                <p className="text-slate-500 max-w-md mt-4 px-4 text-sm font-medium">
                    This page is restricted to SOC Personnel and Administrators.
                </p>
            </div>
        );
    }

    return (
        <div className="fade-in pb-12">
            <ToastContainer position="top-right" autoClose={3000} theme="dark" />

            {/* Elite SOC Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tighter uppercase flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                        Next-Gen SOC Console
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 text-xs tracking-widest uppercase italic pt-1 text-cyan-500/80">
                        Unified SIEM + SOAR + Threat Intelligence Active
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={fetchData} className="text-xs">Refresh SOC</Button>
                    <Badge variant="ghost" className="text-[10px] uppercase border-cyan-500/20 text-cyan-400 py-2">
                        System Health: Optimal
                    </Badge>
                </div>
            </div>

            {/* Elite Threat Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <div className="p-4 bg-slate-900/60 border border-white/5 rounded-xl shadow-lg">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Incidents</div>
                    <div className="text-2xl font-black text-amber-500">{socStats.activeIncidents}</div>
                </div>
                <div className="p-4 bg-slate-900/60 border border-white/5 rounded-xl shadow-lg">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Accounts Suspended</div>
                    <div className="text-2xl font-black text-red-500">{socStats.lockedAccounts}</div>
                </div>
                <div className="p-4 bg-slate-900/60 border border-white/5 rounded-xl shadow-lg">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Blocked IPs</div>
                    <div className="text-2xl font-black text-cyan-500">{socStats.blockedIps}</div>
                </div>
                <div className="p-4 bg-slate-900/60 border border-white/5 rounded-xl shadow-lg">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Telemetry</div>
                    <div className="text-2xl font-black text-slate-300">{socStats.totalAlerts}</div>
                </div>
            </div>

            {/* Attack Simulation Engine */}
            <Card className="border-cyan-500/20 bg-slate-900/40 mb-10 overflow-hidden relative shadow-2xl">
                <div className="absolute top-0 right-0 p-2">
                    <Badge variant="ghost" className="text-[10px] opacity-30">Simulation Mode</Badge>
                </div>
                <div className="p-6">
                    <h2 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Advanced Attack Simulation</h2>
                    <p className="text-xs text-slate-500 mb-6 max-w-2xl">
                        Verify SOAR policies and Detection thresholds. Notice: Account suspension requires 3+ critical events from the same source.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <Button
                            variant="warning"
                            size="sm"
                            className="text-[10px] font-bold uppercase"
                            onClick={() => handleSimulateAttack('brute-force')}
                            loading={simulating}
                        >
                            ⚡ Brute Force
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] font-bold uppercase border-cyan-500/30 text-cyan-400"
                            onClick={() => handleSimulateAttack('insider')}
                            loading={simulating}
                        >
                            👤 Insider Threat
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] font-bold uppercase border-purple-500/30 text-purple-400"
                            onClick={() => handleSimulateAttack('zero-trust')}
                            loading={simulating}
                        >
                            🛡️ Zero Trust Breach
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            className="text-[10px] font-bold uppercase border-red-500/30"
                            onClick={() => handleSimulateAttack('exploit')}
                            loading={simulating}
                        >
                            💀 Critical Exploit
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Security Alert Ledger */}
            <Card className="p-0 overflow-hidden border-white/5 bg-slate-900/40 mb-10">
                <div className="p-6 border-b border-white/5 bg-slate-950/20 flex justify-between items-center">
                    <h2 className="text-lg font-black text-white uppercase tracking-tighter">Unified Threat Feed</h2>
                    <div className="flex gap-2">
                        <Badge variant="ghost" className="text-[10px]">Filtering: All Events</Badge>
                        <Badge variant="danger" className="animate-pulse">Live</Badge>
                    </div>
                </div>

                <div className="table-container border-none rounded-none">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Risk</th>
                                <th>Threat Pattern</th>
                                <th>Source/User</th>
                                <th>Intelligence</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {securityAlerts.map((alert) => (
                                <tr key={alert._id} className="hover:bg-white/5 transition-all group">
                                    <td>
                                        <Badge variant={alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'danger' : 'warning'}>
                                            {alert.severity}
                                        </Badge>
                                    </td>
                                    <td>
                                        <div className="font-black text-white text-xs">{alert.type}</div>
                                        <div className="text-[10px] text-slate-500 mt-1">{new Date(alert.createdAt).toLocaleString()}</div>
                                    </td>
                                    <td>
                                        <div className="text-xs font-mono text-slate-300">{alert.sourceIp}</div>
                                        <div className="text-[10px] text-slate-500">{alert.userId?.email || 'System'}</div>
                                    </td>
                                    <td className="max-w-xs">
                                        <div className="text-xs text-slate-400 line-clamp-1 italic">
                                            {alert.description.includes("[INTEL") ? (
                                                <span className="text-cyan-400 font-bold">{alert.description.split("[INTEL")[1].split("]")[0]}</span>
                                            ) : (alert.description)}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-[10px] px-2 py-1"
                                                onClick={() => {
                                                    setSelectedAlert(alert);
                                                    if (alert.incidentId) handleViewIncident(alert.incidentId);
                                                }}
                                            >
                                                Analyze
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {securityAlerts.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="5" className="text-center py-10 text-slate-500 italic">No autonomous threats detected.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Alert & Incident Modal */}
            {(selectedAlert) && (
                <ConfirmModal
                    isOpen={!!selectedAlert}
                    onClose={() => { setSelectedAlert(null); setSelectedIncident(null); }}
                    title={
                        <div className="flex items-center gap-2">
                            <span className="text-red-500 uppercase font-black text-sm">Target Analysis:</span>
                            <span className="text-white text-sm">{selectedAlert.type}</span>
                        </div>
                    }
                    onConfirm={() => { setSelectedAlert(null); setSelectedIncident(null); }}
                    confirmText="Acknowledge & Close"
                >
                    <div className="space-y-6">
                        {/* Threat Context */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-950 rounded border border-white/5">
                                <div className="text-[10px] font-black text-slate-500 uppercase mb-1">IP Reputaton</div>
                                <div className={`text-xs font-bold ${selectedAlert.description.includes("INTEL") ? "text-red-400" : "text-emerald-400"}`}>
                                    {selectedAlert.description.includes("INTEL") ? "Suspicious / Malicious" : "Clean / Neutral"}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-950 rounded border border-white/5">
                                <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Threshold Context</div>
                                <div className="text-xs font-bold text-slate-300">
                                    Correlated Alerts: {selectedIncident?.alerts?.length || 1}
                                </div>
                            </div>
                        </div>

                        {/* Incident Timeline */}
                        {selectedIncident && (
                            <div className="p-4 bg-slate-950 rounded-xl border border-white/5">
                                <div className="text-[10px] font-black text-cyan-500 uppercase mb-3 tracking-widest">Incident Timeline</div>
                                <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-2 before:w-[1px] before:bg-white/10">
                                    {selectedIncident.timeline.map((item, i) => (
                                        <div key={i} className="relative pl-6 text-[11px]">
                                            <div className="absolute left-1 top-2 w-2 h-2 rounded-full bg-cyan-500" />
                                            <div className="text-white font-bold">{item.event}</div>
                                            <div className="text-slate-500">{item.details}</div>
                                            <div className="text-[9px] text-slate-600 mt-0.5">{new Date(item.timestamp).toLocaleTimeString()}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Analysis */}
                        {selectedAlert.aiAnalysis ? (
                            <div className="space-y-4 fade-in">
                                <div className="p-4 bg-cyan-500/5 rounded border border-cyan-500/20">
                                    <div className="text-[10px] font-black text-cyan-500 uppercase mb-2 flex justify-between">
                                        <span>AI Security Analysis</span>
                                        <span>Confidence: {(selectedAlert.aiAnalysis.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed italic">
                                        "{selectedAlert.aiAnalysis.explanation}"
                                    </p>
                                </div>
                                <div className="p-4 bg-emerald-500/5 rounded border border-emerald-500/20">
                                    <div className="text-[10px] font-black text-emerald-500 uppercase mb-1">SOAR Recommendation</div>
                                    <p className="text-xs text-white font-bold uppercase">
                                        {selectedAlert.aiAnalysis.recommendation}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 text-center">
                                <Button
                                    loading={analyzingId === selectedAlert._id}
                                    onClick={() => handleAIAnalyze(selectedAlert._id)}
                                    variant="danger"
                                    className="bg-cyan-600 border-cyan-500 text-xs py-2"
                                >
                                    Force Gemini AI Triage
                                </Button>
                                <p className="text-[10px] text-slate-500 mt-2 italic">Deeper context-aware analysis via Vertex AI</p>
                            </div>
                        )}
                    </div>
                </ConfirmModal>
            )}

            {/* High-Risk Entities Heatmap */}
            <div className="mt-10 mb-10">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Identity Threat Profiler
                </h3>
                <Card className="p-0 overflow-hidden border-red-500/20 bg-slate-900/40">
                    <div className="table-container border-none rounded-none">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>User Principal</th>
                                    <th>Threat Level</th>
                                    <th>Risk Score Matrix</th>
                                </tr>
                            </thead>
                            <tbody>
                                {socStats?.highRiskUsers?.map((user) => (
                                    <tr key={user._id} className="hover:bg-red-500/5 transition-all">
                                        <td className="font-bold text-slate-200">
                                            {user.email}
                                            <div className="text-[10px] text-slate-500">Subject to conditional access blocks</div>
                                        </td>
                                        <td>
                                            <Badge variant={user.behavioralMetadata?.threatLevel === 'CRITICAL' ? 'danger' : 'warning'}>
                                                {user.behavioralMetadata?.threatLevel || 'HIGH'}
                                            </Badge>
                                        </td>
                                        <td className="w-64">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${user.behavioralMetadata?.threatLevel === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'}`}
                                                        style={{ width: `${Math.min(user.behavioralMetadata?.riskScore || 0, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-black text-slate-400 w-10">{user.behavioralMetadata?.riskScore || 0}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!socStats?.highRiskUsers || socStats.highRiskUsers.length === 0) && (
                                    <tr><td colSpan="3" className="text-center py-6 text-slate-500 italic">No elevated Identity Threats detected in current window.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Asset Performance & Risk Table */}
            <div className="mt-20">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500" /> Distributed Node Analytics
                </h3>
                <Card className="p-0 overflow-hidden border-white/5 bg-slate-900/40">
                    <div className="table-container border-none rounded-none">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Asset Node</th>
                                    <th>Network Address</th>
                                    <th>Risk Index</th>
                                    <th>Security Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assetAlerts.map((asset) => (
                                    <tr key={asset._id}>
                                        <td className="font-bold text-slate-200 uppercase text-xs">{asset.name}</td>
                                        <td className="font-mono text-[10px] text-slate-500">{asset.ipAddress}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${asset.riskScore > 70 ? 'bg-red-500' : asset.riskScore > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${asset.riskScore}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400">{asset.riskScore}%</span>
                                            </div>
                                        </td>
                                        <td className="text-[10px] italic text-slate-400">
                                            {asset.riskScore > 0 ? "Under investigation: High correlation of events." : "Stable baseline. Regular health check passed."}
                                        </td>
                                    </tr>
                                ))}
                                {assetAlerts.length === 0 && (
                                    <tr><td colSpan="4" className="text-center py-4 text-slate-500">No managed nodes matching current policy.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default Cybersecurity;

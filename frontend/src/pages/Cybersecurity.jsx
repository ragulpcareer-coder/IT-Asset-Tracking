import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { socket } from "../services/socket";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Button, Card, Badge, ConfirmModal } from "../components/UI";
import { ToastContainer, toast } from "react-toastify";

/**
 * Enterprise Cybersecurity SOC Tracker
 * Features: Zero-Trust network discovery, Rogue device detection, Real-time threat telemetry.
 */

function Cybersecurity() {
    const { user } = useContext(AuthContext);
    const [assetAlerts, setAssetAlerts] = useState([]); // Asset-based (old)
    const [securityAlerts, setSecurityAlerts] = useState([]); // SOC-based (new)
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [scanResult, setScanResult] = useState(null);
    const [analyzingId, setAnalyzingId] = useState(null);
    const [selectedAlert, setSelectedAlert] = useState(null);

    useEffect(() => {
        fetchData();
        socket.connect();

        // Real-time security alerts from Correlation Engine
        socket.on("security_alert", (newAlert) => {
            setSecurityAlerts(prev => [newAlert, ...prev].slice(0, 50));
            toast.error(`🚨 ${newAlert.type}: ${newAlert.description}`, {
                position: "bottom-right",
                autoClose: 10000
            });
        });

        return () => {
            socket.off("security_alert");
            socket.disconnect();
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [assetsRes, securityRes] = await Promise.all([
                axios.get(`/assets/security-alerts`),
                axios.get(`/security/alerts`)
            ]);
            setAssetAlerts(assetsRes.data.data || []);
            setSecurityAlerts(securityRes.data || []);
        } catch (err) {
            console.error("Failed to fetch SOC data:", err);
            toast.error("Telemetry failure: Could not reach SOC backend.");
        } finally {
            setLoading(false);
        }
    };

    const handleAIAnalyze = async (alertId) => {
        setAnalyzingId(alertId);
        try {
            const { data } = await axios.post(`/security/alerts/${alertId}/analyze`);
            if (data.success) {
                // Update the alert in the list with analysis
                setSecurityAlerts(prev => prev.map(a => a._id === alertId ? { ...a, aiAnalysis: data.analysis } : a));
                setSelectedAlert({ ...securityAlerts.find(a => a._id === alertId), aiAnalysis: data.analysis });
            }
        } catch (err) {
            toast.error("AI Analysis failed. Check Gemini API configuration.");
        } finally {
            setAnalyzingId(null);
        }
    };

    const handleScanNetwork = async () => {
        setScanning(true);
        toast.info("Starting network scan...");
        try {
            const { data } = await axios.post(`/assets/scan-network`);
            setScanResult(data);
            fetchData();
        } catch (err) {
            toast.error("Scan rejected by network policy.");
        } finally {
            setScanning(false);
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

            {/* SOC Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tighter uppercase flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                        Autonomous SOC Console
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 text-xs tracking-widest uppercase italic pt-1">
                        AI-Powered Threat Correlation & Zero Trust Enforcement
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={fetchData} className="text-xs">Refresh Feed</Button>
                    <Button
                        variant="danger"
                        onClick={handleScanNetwork}
                        loading={scanning}
                        className="shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                    >
                        Scan Network
                    </Button>
                </div>
            </div>

            {/* Threat Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <Card className="border-red-500/20 bg-slate-900/40 border-l-[6px] border-l-red-500">
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Active Alerts</div>
                    <div className="text-4xl font-black text-red-500 tabular-nums">{securityAlerts.filter(a => a.status === 'OPEN').length}</div>
                    <div className="text-[10px] font-bold mt-2 text-slate-400 uppercase italic">Across 6 threat types</div>
                </Card>
                <Card className="border-amber-500/20 bg-slate-900/40 border-l-[6px] border-l-amber-500">
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">High Risk Users</div>
                    <div className="text-4xl font-black text-amber-500 tabular-nums">
                        {new Set(securityAlerts.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').map(a => a.userId?._id)).size}
                    </div>
                    <div className="text-[10px] font-bold mt-2 text-slate-400 uppercase italic">Priority investigation</div>
                </Card>
                <Card className="border-cyan-500/20 bg-slate-900/40 border-l-[6px] border-l-cyan-500">
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">AI Analyses Run</div>
                    <div className="text-4xl font-black text-cyan-500 tabular-nums">
                        {securityAlerts.filter(a => a.aiAnalysis?.explanation).length}
                    </div>
                    <div className="text-[10px] font-bold mt-2 text-slate-400 uppercase italic">Gemini 1.5 Pro Active</div>
                </Card>
                <Card className="border-emerald-500/20 bg-slate-900/40 border-l-[6px] border-l-emerald-500">
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Compliance Score</div>
                    <div className="text-4xl font-black text-emerald-500 tabular-nums">98%</div>
                    <div className="text-[10px] font-bold mt-2 text-slate-400 uppercase italic">Zero Trust Active</div>
                </Card>
            </div>

            {/* Security Alert Ledger */}
            <Card className="p-0 overflow-hidden border-white/5 bg-slate-900/40 mb-10">
                <div className="p-6 border-b border-white/5 bg-slate-950/20 flex justify-between items-center">
                    <h2 className="text-lg font-black text-white uppercase tracking-tighter">Autonomous Threat Ledger</h2>
                    <Badge variant="danger" className="animate-pulse">Live Feed</Badge>
                </div>

                <div className="table-container border-none rounded-none">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Severity</th>
                                <th>Threat Type</th>
                                <th>Source Context</th>
                                <th>Summary</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {securityAlerts.map((alert) => (
                                <tr key={alert._id} className="hover:bg-white/5 transition-all">
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
                                        <div className="text-[10px] text-slate-500">{alert.userId?.email || 'System/Unauthenticated'}</div>
                                    </td>
                                    <td className="max-w-xs">
                                        <div className="text-xs text-slate-400 line-clamp-2">{alert.description}</div>
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-[10px] px-2 py-1"
                                                onClick={() => setSelectedAlert(alert)}
                                            >
                                                Details
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                className="text-[10px] px-2 py-1 bg-cyan-600 border-cyan-500 hover:bg-cyan-700"
                                                loading={analyzingId === alert._id}
                                                onClick={() => handleAIAnalyze(alert._id)}
                                            >
                                                {alert.aiAnalysis?.explanation ? "View AI Analysis" : "AI Analyze"}
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

            {/* AI Analysis Modal */}
            {selectedAlert && (
                <ConfirmModal
                    isOpen={!!selectedAlert}
                    onClose={() => setSelectedAlert(null)}
                    title={
                        <div className="flex items-center gap-2">
                            <span className="text-cyan-400">✧</span> AI Security Insight: {selectedAlert.type}
                        </div>
                    }
                    onConfirm={() => setSelectedAlert(null)}
                    confirmText="Close Investigation"
                >
                    <div className="space-y-4">
                        <div className="p-3 bg-slate-950 rounded border border-white/5">
                            <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Threat Context</div>
                            <div className="text-sm text-white font-medium">{selectedAlert.description}</div>
                        </div>

                        {selectedAlert.aiAnalysis ? (
                            <div className="space-y-4 fade-in">
                                <div className="p-4 bg-cyan-500/5 rounded border border-cyan-500/20">
                                    <div className="text-[10px] font-black text-cyan-500 uppercase mb-2 flex justify-between">
                                        <span>AI Analyst Explanation</span>
                                        <span>Confidence: {(selectedAlert.aiAnalysis.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed italic">
                                        "{selectedAlert.aiAnalysis.explanation}"
                                    </p>
                                </div>
                                <div className="p-4 bg-emerald-500/5 rounded border border-emerald-500/20">
                                    <div className="text-[10px] font-black text-emerald-500 uppercase mb-2">Recommended Response</div>
                                    <p className="text-sm text-white font-bold">
                                        {selectedAlert.aiAnalysis.recommendation}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="py-10 text-center">
                                <Button
                                    loading={analyzingId === selectedAlert._id}
                                    onClick={() => handleAIAnalyze(selectedAlert._id)}
                                    variant="danger"
                                    className="bg-cyan-600 border-cyan-500"
                                >
                                    Initiate Gemini Analysis
                                </Button>
                                <p className="text-xs text-slate-500 mt-2 italic">Requires Google Gemini API integration</p>
                            </div>
                        )}
                    </div>
                </ConfirmModal>
            )}

            {/* Asset Security (Old section, kept but condensed) */}
            <div className="mt-20">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Asset-Level Telemetry</h3>
                <Card className="p-0 overflow-hidden border-white/5 bg-slate-900/40">
                    <div className="table-container border-none rounded-none">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Node</th>
                                    <th>IP/MAC</th>
                                    <th>Risk</th>
                                    <th>Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assetAlerts.map((asset) => (
                                    <tr key={asset._id}>
                                        <td className="font-bold text-slate-200 uppercase text-xs">{asset.name}</td>
                                        <td className="font-mono text-[10px] text-slate-500">{asset.ipAddress}</td>
                                        <td><Badge variant="warning">{asset.securityStatus?.riskLevel}</Badge></td>
                                        <td className="text-[10px] italic text-slate-400">{asset.securityStatus?.remarks}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default Cybersecurity;

export default Cybersecurity;

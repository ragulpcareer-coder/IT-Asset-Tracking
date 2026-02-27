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
    const [alerts, setAlerts] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [auditAlerts, setAuditAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scanResult, setScanResult] = useState(null);

    useEffect(() => {
        fetchAlerts();
        fetchAuditAlerts();
        socket.connect();
        socket.on("securityAlert", () => {
            fetchAlerts();
            fetchAuditAlerts();
        });
        return () => {
            socket.off("securityAlert");
            socket.disconnect();
        };
    }, []);

    const fetchAlerts = async () => {
        try {
            const { data } = await axios.get(`/assets/security-alerts`);
            setAlerts(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditAlerts = async () => {
        try {
            const { data } = await axios.get(`/audit?action=SECURITY`);
            setAuditAlerts(data.logs || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleScanNetwork = async () => {
        setScanning(true);
        setScanResult(null);
        toast.info("Initiating deep network discovery protocol...");
        try {
            const { data } = await axios.post(`/assets/scan-network`);
            setScanResult(data);
            toast.success("Discovery Scan Completed Safely.");
            fetchAlerts();
            fetchAuditAlerts();
        } catch (err) {
            toast.error("Discovery rejected: Network firewall or role violation.");
            setScanResult({ message: "Discovery Interrupted" });
        } finally {
            setScanning(false);
        }
    };

    if (!user || !["Super Admin", "Admin"].includes(user.role)) {
        return (
            <div className="flex-center min-h-[60vh] flex-col text-center card bg-slate-900/50 border-red-500/20">
                <div className="text-5xl mb-6">🔒</div>
                <h2 className="text-2xl font-black text-white px-2">Access Denied: SOC Gate Restricted</h2>
                <p className="text-slate-500 max-w-md mt-4 px-4 text-sm font-medium">
                    The Security Operations Center (SOC) dashboard is restricted to Tier-1 Cyber-Administrators.
                    Attempts to bypass the SOC gateway trigger immediate forensic logging.
                </p>
            </div>
        );
    }

    return (
        <div className="fade-in pb-12">
            <ToastContainer position="top-right" autoClose={3000} theme="dark" />

            {/* SOC Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-red-500 tracking-tighter uppercase flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                        Security Operations Center (SOC)
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 text-xs tracking-widest uppercase italic pt-1">
                        Zero Trust Network Discovery & Rogue Asset Detection
                    </p>
                </div>
                <Button
                    variant="danger"
                    onClick={handleScanNetwork}
                    loading={scanning}
                    disabled={scanning}
                    className="shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                >
                    {scanning ? "Discovering Network..." : "Run Network Discovery"}
                </Button>
            </div>

            {/* Dynamic Scan Logic Alert */}
            {scanResult && (() => {
                const isInterrupted = scanResult.message === "Discovery Interrupted";
                return (
                    <Card className={`mb-8 p-4 border-l-4 bg-slate-900/40 ${isInterrupted ? 'border-red-500/50' : 'border-emerald-500/50'}`}>
                        <div className="flex justify-between items-center">
                            <div>
                                <div className={`text-xs font-black uppercase tracking-widest mb-1 ${isInterrupted ? 'text-red-500' : 'text-emerald-500'}`}>
                                    Discovery Status: {isInterrupted ? 'Interrupted' : 'Completed'}
                                </div>
                                <div className="text-sm font-bold text-white mb-2">
                                    {isInterrupted ? 'No telemetry results available.' : scanResult.message}
                                </div>
                                {scanResult.device && !isInterrupted && (
                                    <div className="text-[10px] font-mono text-slate-400">
                                        NODE: {scanResult.device.ipAddress} | MAC: {scanResult.device.macAddress}
                                    </div>
                                )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setScanResult(null)}>×</Button>
                        </div>
                    </Card>
                );
            })()}

            {/* High-Impact Threat Metrics */}
            {scanResult?.message !== "Discovery Interrupted" && (() => {
                const criticalThreats = alerts.filter(a => a.securityStatus?.riskLevel === 'High' || a.securityStatus?.riskLevel === 'Critical').length;
                const rogueAssets = alerts.filter(a => a.securityStatus?.isAuthorized === false).length;
                const injectionAttempts = auditAlerts.filter(l => l.action?.includes('AI') || l.action?.includes('Injection')).length;
                const complianceScore = Math.max(0, 100 - (criticalThreats * 15) - (rogueAssets * 25));

                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                        <Card className="border-red-500/20 bg-slate-900/40 border-l-[6px] border-l-red-500">
                            <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Critical Threats Detected</div>
                            <div className="text-4xl font-black text-red-500 tabular-nums">
                                {criticalThreats}
                            </div>
                            <div className={`text-[10px] font-bold mt-2 italic uppercase ${criticalThreats > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                {criticalThreats > 0 ? 'Immediate action required' : 'No immediate action required'}
                            </div>
                        </Card>
                        <Card className="border-amber-500/20 bg-slate-900/40 border-l-[6px] border-l-amber-500">
                            <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Rogue Assets Detected</div>
                            <div className="text-4xl font-black text-amber-500 tabular-nums">
                                {rogueAssets}
                            </div>
                            <div className={`text-[10px] font-bold mt-2 italic uppercase ${rogueAssets > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                                {rogueAssets > 0 ? 'Unauthorized devices detected' : 'No unauthorized devices detected'}
                            </div>
                        </Card>
                        <Card className="border-cyan-500/20 bg-slate-900/40 border-l-[6px] border-l-cyan-500">
                            <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Prompt Injection Attempts Blocked</div>
                            <div className="text-4xl font-black text-cyan-500 tabular-nums">
                                {injectionAttempts}
                            </div>
                            <div className="text-[10px] text-cyan-400 font-bold mt-2 italic uppercase">AI Model Protection Active</div>
                        </Card>
                        <Card className="border-emerald-500/20 bg-slate-900/40 border-l-[6px] border-l-emerald-500">
                            <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Zero Trust Compliance</div>
                            <div className={`text-4xl font-black tabular-nums ${complianceScore === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{complianceScore}%</div>
                            <div className={`text-[10px] font-bold mt-2 italic uppercase ${complianceScore === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {complianceScore === 100 ? 'All identities verified' : 'Security Violations Detected'}
                            </div>
                        </Card>
                    </div>
                );
            })()}


            {/* MITRE ATT&CK Intelligence Feed (§Category 3) */}
            {scanResult?.message !== "Discovery Interrupted" && auditAlerts.some(l => l.action?.includes('DETECTION')) && (
                <div className="mb-10">
                    <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                        MITRE ATT&CK Behavioral Reconnaissance
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {auditAlerts.filter(l => l.action?.includes('DETECTION')).slice(0, 8).map((alert, idx) => (
                            <Card key={idx} className="bg-slate-900 border-amber-500/20 p-3 hover:border-amber-500/50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-[9px] font-black px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded uppercase">
                                        {alert.meta?.technique || 'T-UNKNOWN'}
                                    </div>
                                    <div className="text-[8px] font-mono text-slate-500">{new Date(alert.createdAt).toLocaleTimeString()}</div>
                                </div>
                                <div className="text-[11px] font-black text-white uppercase leading-none mb-1">{alert.meta?.tactic || 'Malicious Actor'}</div>
                                <div className="text-[10px] text-slate-400 line-clamp-2 italic">{alert.details}</div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}


            {/* Real-time Threat Matrix Table */}
            {scanResult?.message !== "Discovery Interrupted" && (
                <Card className="p-0 overflow-hidden border-white/5 bg-slate-900/40">
                    <div className="p-6 border-b border-white/5 bg-slate-950/20">
                        <h2 className="text-lg font-black text-white uppercase tracking-tighter">Live Security Ledger</h2>
                    </div>

                    {loading ? (
                        <div className="py-24"><LoadingSpinner message="Decrypting Threat Matrix..." /></div>
                    ) : alerts.length === 0 ? (
                        <div className="text-center py-20 text-slate-500 font-bold uppercase tracking-widest text-sm italic">
                            No active security anomalies detected.
                        </div>
                    ) : (
                        <div className="table-container border-none rounded-none">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Network Node</th>
                                        <th>Network Signature (IP/MAC)</th>
                                        <th>Last Telemetry</th>
                                        <th>Risk Quotient</th>
                                        <th>Threat Remark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alerts.map((asset) => (
                                        <tr key={asset._id} className="hover:bg-red-500/5 transition-all">
                                            <td>
                                                <div className="font-black text-slate-200 uppercase tracking-tight text-sm">
                                                    {asset.name}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="font-mono text-[11px] text-slate-400">{asset.ipAddress || 'STATIC-INTERNAL'}</div>
                                                <div className="font-mono text-[10px] text-slate-600 mt-1 uppercase">{asset.macAddress || 'VIRTUAL-NODE'}</div>
                                            </td>
                                            <td>
                                                <div className="text-[11px] font-bold text-slate-500 italic">
                                                    {asset.networkStatus?.lastSeen ? new Date(asset.networkStatus.lastSeen).toLocaleString() : 'N/A'}
                                                </div>
                                            </td>
                                            <td>
                                                <Badge variant={asset.securityStatus?.riskLevel === 'Critical' ? 'danger' : 'warning'} className="font-black">
                                                    {asset.securityStatus?.riskLevel || 'High'}
                                                </Badge>
                                            </td>
                                            <td>
                                                <div className="text-[11px] font-bold text-red-500/80 uppercase italic tracking-tight">
                                                    {asset.securityStatus?.remarks || 'Unauthorized Access Vector'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

export default Cybersecurity;

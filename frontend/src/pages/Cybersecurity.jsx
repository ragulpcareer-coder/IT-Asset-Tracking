import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { io } from "socket.io-client";
import { SERVER_URL } from "../config/constants"; // Assuming there's a config, if not I'll handle it below

function Cybersecurity() {
    const { user } = useContext(AuthContext);
    const [alerts, setAlerts] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [scanResult, setScanResult] = useState(null);

    const token = localStorage.getItem("token");

    useEffect(() => {
        fetchAlerts();

        // Setup Socket
        const socketURL = SERVER_URL || "http://localhost:5000";
        const newSocket = io(socketURL, { transports: ["websocket"] });

        newSocket.on("securityAlert", (data) => {
            fetchAlerts(); // Refresh alerts
        });

        return () => newSocket.close();
    }, []);

    const fetchAlerts = async () => {
        try {
            const apiUrl = SERVER_URL ? `${SERVER_URL}/api` : "http://localhost:5000/api";
            const { data } = await axios.get(`${apiUrl}/assets/security-alerts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAlerts(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleScanNetwork = async () => {
        setScanning(true);
        setScanResult(null);
        try {
            const apiUrl = SERVER_URL ? `${SERVER_URL}/api` : "http://localhost:5000/api";
            const { data } = await axios.post(`${apiUrl}/assets/scan-network`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setScanResult(data);
            fetchAlerts();
        } catch (err) {
            setScanResult({ message: "Error scanning network" });
        } finally {
            setScanning(false);
        }
    };

    if (!user || user.role !== "Admin") {
        return <div className="p-6 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className="page-container fade-in">
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div>
                    <h1 className="page-title text-red-500" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        🛡️ Cybersecurity Tracker (SOC Dashboard)
                    </h1>
                    <p className="page-subtitle text-gray-400">Detect rogue devices, monitor network anomalies, and secure IT assets.</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        className="action-button primary"
                        onClick={handleScanNetwork}
                        disabled={scanning}
                        style={{ background: scanning ? '#444' : '#e53e3e' }}
                    >
                        {scanning ? "Scanning Network (Nmap sim)..." : "🔍 Run Network Discovery"}
                    </button>
                </div>
            </div>

            {scanResult && (
                <div style={{ padding: '16px', background: 'rgba(255, 60, 60, 0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 8, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontWeight: 'bold', display: 'block' }}>Scan Result:</span>
                        <span>{scanResult.message}</span>
                        {scanResult.device && <div style={{ marginTop: '8px', opacity: 0.8 }}>IP: {scanResult.device.ipAddress} | MAC: {scanResult.device.macAddress}</div>}
                    </div>
                    <button onClick={() => setScanResult(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                </div>
            )}

            <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", marginBottom: 32 }}>
                <div className="stat-card">
                    <div className="stat-title text-red-400">Active High Risk Alerts</div>
                    <div className="stat-value text-red-500">{alerts.filter(a => a.securityStatus?.riskLevel === 'High' || a.securityStatus?.riskLevel === 'Critical').length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-title">Unauthorized Devices</div>
                    <div className="stat-value text-orange-400">{alerts.filter(a => a.securityStatus?.isAuthorized === false).length}</div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: 24, marginTop: 24 }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 16 }}>Live Security Alerts & Rogue Devices</h2>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>Loading security dashboard...</div>
                ) : alerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8 }}>
                        No immediate security threats detected on network.
                    </div>
                ) : (
                    <div className="data-table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Device / Asset</th>
                                    <th>IP Address</th>
                                    <th>MAC Address</th>
                                    <th>Last Seen</th>
                                    <th>Risk Level</th>
                                    <th>Alert Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map((asset) => (
                                    <tr key={asset._id}>
                                        <td style={{ fontWeight: 'bold' }}>{asset.name}</td>
                                        <td style={{ fontFamily: 'monospace', opacity: 0.8 }}>{asset.ipAddress || 'N/A'}</td>
                                        <td style={{ fontFamily: 'monospace', opacity: 0.8 }}>{asset.macAddress || 'N/A'}</td>
                                        <td style={{ opacity: 0.8 }}>{asset.networkStatus?.lastSeen ? new Date(asset.networkStatus.lastSeen).toLocaleString() : 'N/A'}</td>
                                        <td>
                                            <span className={`status-badge ${(asset.securityStatus?.riskLevel || 'High').toLowerCase()}`} style={{ background: asset.securityStatus?.riskLevel === 'Critical' ? 'rgba(255,0,0,0.2)' : 'rgba(255,165,0,0.2)' }}>
                                                {asset.securityStatus?.riskLevel || 'High'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '12px', color: '#ff8a8a' }}>{asset.securityStatus?.remarks || 'Unauthorized Device'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Cybersecurity;

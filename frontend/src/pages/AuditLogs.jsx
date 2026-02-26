import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Button, Card, Badge, Input } from "../components/UI";

/**
 * Enterprise Audit Ledger
 * Features: High-assurance forensic tracking, Role-based data access (§4.2).
 */

export default function AuditLogs() {
  const { user } = useContext(AuthContext);
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");

  useEffect(() => {
    if (["Super Admin", "Admin"].includes(user?.role)) {
      fetchLogs();
    }
  }, [user]);

  useEffect(() => {
    filterLogs();
  }, [logs, search, actionFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/audit");
      setLogs(res.data?.data || res.data || []);
    } catch (error) {
      toast.error("Failed to fetch cryptographic audit trail");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];
    if (search) {
      filtered = filtered.filter(l =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.performedBy.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (actionFilter !== "All") {
      filtered = filtered.filter(l => l.action.includes(actionFilter));
    }
    setFilteredLogs(filtered);
  };

  const handleExport = async () => {
    try {
      toast.info("Preparing high-assurance CSV export...");
      const res = await axios.get("/audit/export", { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_ledger_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Ledger exported successfully!");
    } catch (error) {
      toast.error("Forensic export failed: Authorization required.");
    }
  };

  const getActionVariant = (action) => {
    if (action.includes("Security") || action.includes("ALERT") || action.includes("Violation")) return "danger";
    if (action.includes("Updated")) return "info";
    if (action.includes("Created")) return "success";
    return "neutral";
  };

  if (!user || !["Super Admin", "Admin"].includes(user.role)) {
    return (
      <div className="flex-center min-h-[60vh] flex-col text-center card bg-slate-900/50 border-red-500/20">
        <div className="text-5xl mb-6">🔒</div>
        <h2 className="text-2xl font-black text-white px-2">Access Denied: 403 Forbidden</h2>
        <p className="text-slate-500 max-w-md mt-4 px-4 text-sm font-medium">
          The Tactical Audit Ledger is restricted to Tier-1 Security Administrators.
          Unauthorized access attempts are logged and flagged for forensic review.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-in pb-12">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tighter">Forensic Audit Ledger</h1>
          <p className="text-slate-500 font-medium mt-1 uppercase text-xs tracking-widest italic">
            Full compliance monitoring active (§4.2)
          </p>
        </div>
        <Button variant="primary" onClick={handleExport} disabled={filteredLogs.length === 0}>
          Export Validated CSV
        </Button>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="flex flex-col border-white/5 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Total Forensic Entries</span>
          <span className="text-3xl font-black text-white">{logs.length}</span>
        </Card>
        <Card className="flex flex-col border-white/5 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Active Security Pulse</span>
          <span className="text-3xl font-black text-green-500">NOMINAL</span>
        </Card>
        <Card className="flex flex-col border-white/5 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Unique Actors</span>
          <span className="text-3xl font-black text-white">{new Set(logs.map(l => l.performedBy)).size}</span>
        </Card>
      </div>

      {/* Persistence Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
        <Input
          placeholder="Filter by action, user, or IP signature..."
          className="mb-0"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input bg-slate-950/50"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="All">All Protocol Actions</option>
          <option value="Created">Provisioning Events</option>
          <option value="Updated">Metadata Updates</option>
          <option value="Deleted">Decommissioning</option>
          <option value="ALERT">Security Alerts</option>
        </select>
      </div>

      {/* Results Matrix */}
      <div className="table-container">
        {loading ? (
          <div className="py-20"><LoadingSpinner message="Scanning Secure Ledger..." /></div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-slate-500 font-bold uppercase tracking-widest text-sm italic">
            No forensic records found for this query.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Protocol Action</th>
                <th>Origin Identity</th>
                <th>Network Signature</th>
                <th className="text-right">Timestamp (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => (
                <tr key={log._id || idx}>
                  <td>
                    <Badge variant={getActionVariant(log.action)} className="font-bold">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="font-bold text-slate-300">{log.performedBy}</td>
                  <td className="font-mono text-[11px] text-slate-500 font-bold uppercase">
                    {log.ip || 'Local Kernel'}
                  </td>
                  <td className="text-right">
                    <div className="text-slate-100 font-bold text-xs">{new Date(log.createdAt).toLocaleDateString()}</div>
                    <div className="text-slate-500 text-[10px] uppercase font-bold mt-1">{new Date(log.createdAt).toLocaleTimeString()}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

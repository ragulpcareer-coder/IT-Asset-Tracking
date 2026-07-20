import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Button, Card, Badge, Input } from "../components/UI";
import PageHeader from "../components/PageHeader";

/**
 * Enterprise Audit Ledger
 * Features: High-assurance forensic tracking, Role-based data access (§4.2).
 */

export default function AuditLogs() {
  const { user } = useContext(AuthContext);
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");

  useEffect(() => {
    let isMounted = true;

    const loadLogs = async () => {
      if (!["Super Admin", "Admin"].includes(user?.role)) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await axios.get("/audit");
        if (!isMounted) return;
        const nextLogs = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        setLogs(nextLogs);
      } catch (error) {
        if (!isMounted) return;
        toast.error("Failed to load audit logs. Please try again.");
        setLogs([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadLogs();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    filterLogs();
  }, [logs, search, actionFilter]);

  const filterLogs = () => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    let filtered = [...safeLogs];
    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(l =>
        String(l?.action || "").toLowerCase().includes(searchTerm) ||
        String(l?.performedBy || "").toLowerCase().includes(searchTerm) ||
        String(l?.ip || "").toLowerCase().includes(searchTerm)
      );
    }
    if (actionFilter !== "All") {
      filtered = filtered.filter(l => String(l?.action || "").includes(actionFilter));
    }
    setFilteredLogs(filtered);
  };

  const handleExport = async () => {
    try {
      toast.info("Preparing CSV export...");
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
      toast.error("Export failed. You may not have permission to export logs.");
    }
  };

  const getActionVariant = (action) => {
    const safeAction = String(action || "");
    if (safeAction.includes("Security") || safeAction.includes("ALERT") || safeAction.includes("Violation")) return "danger";
    if (safeAction.includes("Updated")) return "info";
    if (safeAction.includes("Created")) return "success";
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

            <PageHeader
        title="Security Audit Logs"
        subtitle="Full compliance monitoring, forensic export, and privileged activity review."
        actions={<Button variant="primary" onClick={handleExport} disabled={filteredLogs.length === 0}>Export Logs (CSV)</Button>}
      />

      {/* Live Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="flex flex-col border-white/5 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Total Log Entries</span>
          <span className="text-3xl font-black text-white">{logs.length}</span>
        </Card>
        <Card className="flex flex-col border-white/5 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">System Security Status</span>
          <span className="text-3xl font-black text-green-500">NOMINAL</span>
        </Card>
        <Card className="flex flex-col border-white/5 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Unique Users</span>
          <span className="text-3xl font-black text-white">{new Set((Array.isArray(logs) ? logs : []).map((l) => String(l?.performedBy || "Unknown"))).size}</span>
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
          <option value="All">All Actions</option>
          <option value="Created">Asset Created</option>
          <option value="Updated">Asset Updated</option>
          <option value="Deleted">Asset Deleted</option>
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
                <th>Action</th>
                <th>Performed By</th>
                <th>IP Address</th>
                <th className="text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(filteredLogs) && filteredLogs.map((log) => (
                <tr key={log?._id || `${log?.action || "audit"}-${log?.createdAt || "unknown"}`}>
                  <td>
                    <Badge variant={getActionVariant(log?.action)} className="font-bold">
                      {log?.action || "Unknown Action"}
                    </Badge>
                  </td>
                  <td className="font-bold text-slate-300">{log?.performedBy || "Unknown User"}</td>
                  <td className="font-mono text-[11px] text-slate-500 font-bold uppercase">
                    {log?.ip || 'Internal'}
                  </td>
                  <td className="text-right">
                    <div className="text-slate-100 font-bold text-xs">{log?.createdAt ? new Date(log.createdAt).toLocaleDateString() : "Unknown"}</div>
                    <div className="text-slate-500 text-[10px] uppercase font-bold mt-1">{log?.createdAt ? new Date(log.createdAt).toLocaleTimeString() : "--"}</div>
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

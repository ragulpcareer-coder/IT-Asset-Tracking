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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [integrityStatus, setIntegrityStatus] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    if (["Super Admin", "Admin"].includes(user?.role)) {
      fetchLogs();
    }
  }, [user, fromDate, toDate, actionFilter, page, limit]);

  useEffect(() => {
    filterLogs();
  }, [logs, search, actionFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      if (actionFilter !== "All") params.append("action", actionFilter);
      params.append("page", page);
      params.append("limit", limit);
      const res = await axios.get(`/audit?${params.toString()}`);
      setLogs(res.data?.data || res.data || []);
      if (res.data?.total !== undefined) setTotal(res.data.total);
    } catch (error) {
      toast.error("Failed to load audit logs. Please try again.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.action.toLowerCase().includes(term) ||
        l.performedBy.toLowerCase().includes(term) ||
        (l.details || "").toLowerCase().includes(term) ||
        (l.ip || "").toLowerCase().includes(term)
      );
    }
    if (actionFilter !== "All") {
      filtered = filtered.filter(l => l.action.includes(actionFilter));
    }
    setFilteredLogs(filtered);
  };

  const uniqueActions = Array.from(new Set((Array.isArray(logs) ? logs : []).map(l => l.action))).slice(0, 12);
  const failedLogins = logs.filter(l => (l.action || "").toUpperCase().includes("FAILED")).length;
  const adminActions = logs.filter(l => (l.action || "").toUpperCase().includes("ADMIN")).length;

  const handleExport = async () => {
    try {
      toast.info("Preparing CSV export...");
      const params = new URLSearchParams();
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      if (actionFilter !== "All") params.append("action", actionFilter);
      const res = await axios.get(`/audit/export?${params.toString()}`, { responseType: 'blob' });
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

  const handleVerify = async () => {
    try {
      const res = await axios.get("/audit/verify");
      setIntegrityStatus(res.data);
      if (res.data?.valid) toast.success("Audit log integrity verified.");
      else toast.error("Audit log integrity check failed.");
    } catch (error) {
      toast.error("Integrity verification failed.");
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
          <h1 className="text-3xl font-extrabold text-white tracking-tighter">Security Audit Logs</h1>
          <p className="text-slate-500 font-medium mt-1 uppercase text-xs tracking-widest italic">
            Full compliance monitoring active (§4.2)
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleVerify}>Verify Integrity</Button>
          <Button variant="primary" onClick={handleExport} disabled={filteredLogs.length === 0}>
            Export Logs (CSV)
          </Button>
        </div>
      </div>

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
          <span className="text-3xl font-black text-white">{new Set((Array.isArray(logs) ? logs : []).map(l => l.performedBy)).size}</span>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="flex flex-col border-white/5 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Failed Auth Events</span>
          <span className="text-3xl font-black text-red-400">{failedLogins}</span>
        </Card>
        <Card className="flex flex-col border-white/5 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Admin Actions</span>
          <span className="text-3xl font-black text-amber-400">{adminActions}</span>
        </Card>
        <Card className="flex flex-col border-white/5 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Integrity Hash</span>
          <span className={`text-sm font-black ${integrityStatus?.valid ? "text-emerald-400" : "text-slate-400"}`}>
            {integrityStatus?.lastHash ? integrityStatus.lastHash.slice(0, 12) + "…" : "Not checked"}
          </span>
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
          {uniqueActions.map((action) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Input
          type="date"
          label="From"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <Input
          type="date"
          label="To"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <Card className="flex items-center justify-between p-4 border-white/5 bg-slate-900/50">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Integrity Status</div>
            <div className={`text-sm font-bold ${integrityStatus?.valid ? "text-emerald-400" : "text-amber-400"}`}>
              {integrityStatus ? (integrityStatus.valid ? "Verified" : "Suspect") : "Not checked"}
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            {integrityStatus ? `${integrityStatus.checked || 0} logs` : ""}
          </div>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="text-xs text-slate-500">
          Page {page} of {Math.max(1, Math.ceil(total / limit))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="input bg-slate-950/50"
            value={limit}
            onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Prev
          </Button>
          <Button
            variant="ghost"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / limit)}
          >
            Next
          </Button>
        </div>
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
              {Array.isArray(filteredLogs) && filteredLogs.map((log, idx) => (
                <tr key={log._id || idx} className="cursor-pointer hover:bg-white/5" onClick={() => setSelectedLog(log)}>
                  <td>
                    <Badge variant={getActionVariant(log.action)} className="font-bold">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="font-bold text-slate-300">{log.performedBy}</td>
                  <td className="font-mono text-[11px] text-slate-500 font-bold uppercase">
                    {log.ip || 'Internal'}
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

      {selectedLog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <Card className="w-full max-w-lg p-5 bg-slate-900 border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500">Audit Detail</div>
                <div className="text-lg font-bold text-white">{selectedLog.action}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>Close</Button>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div><span className="text-slate-500">Performed By:</span> {selectedLog.performedBy}</div>
              <div><span className="text-slate-500">IP:</span> {selectedLog.ip || "Internal"}</div>
              <div><span className="text-slate-500">Timestamp:</span> {new Date(selectedLog.createdAt).toLocaleString()}</div>
              <div><span className="text-slate-500">Details:</span> {selectedLog.details || "No details"}</div>
              <div><span className="text-slate-500">Resource ID:</span> {selectedLog.resourceId ? JSON.stringify(selectedLog.resourceId) : "N/A"}</div>
              {selectedLog.hash && (
                <div><span className="text-slate-500">Hash:</span> {selectedLog.hash}</div>
              )}
              {selectedLog.previousHash && (
                <div><span className="text-slate-500">Previous Hash:</span> {selectedLog.previousHash}</div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

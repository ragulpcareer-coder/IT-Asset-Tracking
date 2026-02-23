import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";

export default function AuditLogs() {
  const { user } = useContext(AuthContext);
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");

  useEffect(() => {
    if (user?.role === "Admin") {
      fetchLogs();
    }
  }, [user]);

  useEffect(() => {
    filterLogs();
  }, [logs, search, actionFilter, dateFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/audit");
      setLogs(res.data?.data || res.data || []);
    } catch (error) {
      toast.error("Failed to fetch audit logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // Search filter
    if (search) {
      filtered = filtered.filter(
        (log) =>
          log.action.toLowerCase().includes(search.toLowerCase()) ||
          log.performedBy.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Action filter
    if (actionFilter !== "All") {
      filtered = filtered.filter((log) => log.action.includes(actionFilter));
    }

    // Date filter
    if (dateFilter !== "All") {
      const now = new Date();
      if (dateFilter === "today") {
        filtered = filtered.filter((log) => {
          const logDate = new Date(log.createdAt);
          return logDate.toDateString() === now.toDateString();
        });
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((log) => new Date(log.createdAt) >= weekAgo);
      } else if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((log) => new Date(log.createdAt) >= monthAgo);
      }
    }

    setFilteredLogs(filtered);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "All") params.append("action", actionFilter);

      if (dateFilter !== "All") {
        const now = new Date();
        if (dateFilter === "today") {
          now.setHours(0, 0, 0, 0);
          params.append("from", now.toISOString());
        } else if (dateFilter === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          params.append("from", weekAgo.toISOString());
        } else if (dateFilter === "month") {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          params.append("from", monthAgo.toISOString());
        }
      }

      const res = await axios.get(`/audit/export?${params.toString()}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Cryptographic log export complete!");
    } catch (error) {
      toast.error("Failed to fetch export");
    }
  };

  const getActionType = (action) => {
    if (action.includes("Created")) return "created";
    if (action.includes("Updated")) return "updated";
    if (action.includes("Deleted")) return "deleted";
    return "other";
  };

  const getActionColor = (action) => {
    const type = getActionType(action);
    switch (type) {
      case "created":
        return "bg-green-500/10 text-green-400 border border-green-500/20";
      case "updated":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      case "deleted":
        return "bg-red-500/10 text-red-400 border border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
    }
  };

  if (!user || user.role !== "Admin") {
    return (
      <div className="text-center py-16 bg-[#0a0a0a] border border-white/10 rounded-xl mt-8">
        <p className="text-xl text-white font-medium mb-2">Access Denied</p>
        <p className="text-gray-500">You need admin privileges to view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="pb-10 text-white">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* Header */}
      <div className="mb-8 px-4 md:px-2 pt-4 md:pt-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">Audit Logs</h1>
          <p className="text-gray-400 text-xs md:text-sm font-medium">Track all system activities and changes</p>
        </div>
        <button
          onClick={handleExport}
          disabled={filteredLogs.length === 0}
          className="bg-[#111] hover:bg-[#222] border border-white/10 text-white px-5 py-2.5 rounded-lg transition-all text-sm font-medium disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 px-4 md:px-0">
        <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl">
          <p className="text-xs font-medium text-gray-500 mb-2">Total Logs</p>
          <p className="text-2xl font-semibold text-white">{logs.length}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl">
          <p className="text-xs font-medium text-gray-500 mb-2">Today's Actions</p>
          <p className="text-2xl font-semibold text-white">
            {logs.filter((l) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl col-span-2 md:col-span-1">
          <p className="text-xs font-medium text-gray-500 mb-2">Unique Users</p>
          <p className="text-2xl font-semibold text-white">{new Set(logs.map((l) => l.performedBy)).size}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-[#0a0a0a] border border-white/10 rounded-xl p-4 mx-4 md:mx-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search logs..."
            className="w-full bg-[#111] border border-white/10 text-white p-2.5 rounded-lg focus:ring-1 focus:ring-white outline-none transition-all placeholder-gray-600 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="w-full bg-[#111] border border-white/10 text-white p-2.5 rounded-lg focus:ring-1 focus:ring-white outline-none transition-all text-sm appearance-none"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="All">All Actions</option>
            <option value="Created">Created</option>
            <option value="Updated">Updated</option>
            <option value="Deleted">Deleted</option>
          </select>
          <select
            className="w-full bg-[#111] border border-white/10 text-white p-2.5 rounded-lg focus:ring-1 focus:ring-white outline-none transition-all text-sm appearance-none"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="All">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-16 bg-[#0a0a0a] border border-white/10 rounded-xl">
          <span className="text-gray-400 font-medium">No logs found matching your criteria.</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#000000]">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 bg-[#050505]">
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Action</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Performed By</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => {
                const date = new Date(log.createdAt);
                return (
                  <tr key={idx} className="border-b border-white/5 hover:bg-[#0a0a0a] transition-colors">
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded border text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{log.performedBy}</td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                      {date.toLocaleDateString()} <span className="text-gray-600 px-1">•</span> {date.toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

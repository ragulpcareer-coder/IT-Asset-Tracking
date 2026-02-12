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
      setLogs(res.data || []);
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

  const handleExport = () => {
    const csvContent = [
      ["Action", "Performed By", "Date", "Time"],
      ...filteredLogs.map((log) => {
        const date = new Date(log.createdAt);
        return [log.action, log.performedBy, date.toLocaleDateString(), date.toLocaleTimeString()];
      }),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const element = document.createElement("a");
    element.setAttribute("href", `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`);
    element.setAttribute("download", `audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Exported successfully");
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
        return "bg-green-100 text-green-800";
      case "updated":
        return "bg-blue-100 text-blue-800";
      case "deleted":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!user || user.role !== "Admin") {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">🔒 Access Denied: Admin only</p>
        <p className="text-gray-500 mt-2">You need admin privileges to view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Audit Logs</h1>
        <p className="text-gray-600 mt-1">Track all system activities and changes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-500 text-white p-4 rounded-lg shadow">
          <p className="text-sm font-medium">Total Logs</p>
          <p className="text-3xl font-bold mt-2">{logs.length}</p>
        </div>
        <div className="bg-green-500 text-white p-4 rounded-lg shadow">
          <p className="text-sm font-medium">Today's Actions</p>
          <p className="text-3xl font-bold mt-2">
            {logs.filter((l) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-purple-500 text-white p-4 rounded-lg shadow">
          <p className="text-sm font-medium">Unique Users</p>
          <p className="text-3xl font-bold mt-2">{new Set(logs.map((l) => l.performedBy)).size}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="🔍 Search logs..."
            className="border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="All">All Actions</option>
            <option value="Created">Created</option>
            <option value="Updated">Updated</option>
            <option value="Deleted">Deleted</option>
          </select>
          <select
            className="border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="All">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>

        <button
          onClick={handleExport}
          disabled={filteredLogs.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition font-semibold"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading audit logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-xl text-gray-600">No logs found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                <th className="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Performed By</th>
                <th className="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredLogs.map((log, idx) => {
                const date = new Date(log.createdAt);
                return (
                  <tr key={idx} className="border-b hover:bg-gray-50 transition">
                    <td className="py-3 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-700">{log.performedBy}</td>
                    <td className="py-3 px-6 text-sm text-gray-600">
                      {date.toLocaleDateString()} {date.toLocaleTimeString()}
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

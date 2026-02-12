import React, { useEffect, useState, useContext } from "react";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { socket } from "../services/socket";
import { ProfessionalIcon } from "../components/ProfessionalIcons";
import { brandIdentity, professionalColors } from "../config/brandIdentity";
import { theme } from "../config/theme";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [assets, setAssets] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsRes, logsRes] = await Promise.all([
        axios.get("/assets"),
        user?.role === "Admin" ? axios.get("/audit") : Promise.resolve({ data: [] }),
      ]);

      setAssets(assetsRes.data.assets || assetsRes.data || []);
      setLogs(logsRes.data || []);
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Real-time updates via Socket
    socket.connect();

    socket.on("assetCreated", (newAsset) => {
      setAssets((prev) => [newAsset, ...prev]);
    });

    socket.on("assetUpdated", (updatedAsset) => {
      setAssets((prev) =>
        prev.map((asset) =>
          asset._id === updatedAsset._id ? updatedAsset : asset
        )
      );
    });

    socket.on("assetDeleted", (deletedId) => {
      setAssets((prev) => prev.filter((asset) => asset._id !== deletedId));
    });

    return () => {
      socket.off("assetCreated");
      socket.off("assetUpdated");
      socket.off("assetDeleted");
      socket.disconnect();
    };
  }, []);

  // Calculate Statistics
  const stats = {
    totalAssets: assets.length,
    available: assets.filter((a) => a.status === "available").length,
    assigned: assets.filter((a) => a.status === "assigned").length,
    maintenance: assets.filter((a) => a.status === "maintenance").length,
    retired: assets.filter((a) => a.status === "retired").length,
    totalLogs: logs.length,
    todayLogs: logs.filter((l) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length,
    uniqueUsers: new Set(logs.map((l) => l.performedBy)).size,
  };

  // Chart Data
  const statusData = [
    { name: "Available", value: stats.available },
    { name: "Assigned", value: stats.assigned },
    { name: "Maintenance", value: stats.maintenance },
    { name: "Retired", value: stats.retired },
  ];

  const COLORS = [
    theme.colors.assetTypes.laptop,
    theme.colors.assetTypes.server,
    theme.colors.assetTypes.printer,
    theme.colors.assetTypes.phone,
  ];

  // Asset types distribution
  const assetTypeData = assets.reduce((acc, asset) => {
    const existing = acc.find((item) => item.name === asset.type);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: asset.type, value: 1 });
    }
    return acc;
  }, []);

  // Recent activities
  const recentActivities = logs.slice(0, 5).map((log) => ({
    action: log.action,
    user: log.performedBy,
    time: new Date(log.createdAt).toLocaleTimeString(),
  }));

  // Compliance metrics
  const assetHealth = {
    compliant: assets.filter((a) => a.status !== "retired").length,
    noncompliant: assets.filter((a) => a.status === "retired").length,
    totalAssets: assets.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Welcome, {user?.name}! 👋</h1>
        <p className="text-gray-600 mt-2">Here's your IT Asset Management dashboard</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total Assets", value: stats.totalAssets, icon: "monitor", key: "total" },
          { label: "Available", value: stats.available, icon: "check", key: "available" },
          { label: "Assigned", value: stats.assigned, icon: "user", key: "assigned" },
          { label: "Maintenance", value: stats.maintenance, icon: "wrench", key: "maintenance" },
          { label: "Retired", value: stats.retired, icon: "trash", key: "retired" },
        ].map((metric, idx) => {
          const metricColors = {
            total: theme.colors.primary[500],
            available: theme.colors.accent.success,
            assigned: theme.colors.primary[600],
            maintenance: theme.colors.accent.warning,
            retired: theme.colors.accent.error,
          };
          return (
            <div 
              key={idx} 
              className="text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition"
              style={{ backgroundColor: metricColors[metric.key] }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">{metric.label}</p>
                  <p className="text-3xl font-bold mt-2">{metric.value}</p>
                </div>
                <div className="opacity-50" style={{ fontSize: '2rem' }}>
                  <ProfessionalIcon name={metric.icon} size={32} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Asset Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Asset Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset Types Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Asset Types</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assetTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Admin Section - Audit Stats & Recent Activities */}
      {user?.role === "Admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Audit Stats */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-bold mb-4">Audit Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">Total Logs</span>
                <span className="text-2xl font-bold">{stats.totalLogs}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Today's Logs</span>
                <span className="text-2xl font-bold">{stats.todayLogs}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Active Users</span>
                <span className="text-2xl font-bold">{stats.uniqueUsers}</span>
              </div>
            </div>
          </div>

          {/* Asset Health */}
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-bold mb-4">Asset Health</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">Compliant</span>
                <span className="text-2xl font-bold">{assetHealth.compliant}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Non-Compliant</span>
                <span className="text-2xl font-bold">{assetHealth.noncompliant}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Total</span>
                <span className="text-2xl font-bold">{assetHealth.totalAssets}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <a
                href="/assets"
                className="block w-full bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded-lg transition text-center font-semibold"
              >
                ➕ Add Asset
              </a>
              <a
                href="/audit-logs"
                className="block w-full bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded-lg transition text-center font-semibold"
              >
                📋 View Logs
              </a>
              <a
                href="/settings"
                className="block w-full bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded-lg transition text-center font-semibold"
              >
                ⚙️ Settings
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activities */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Recent Activities</h2>
        {logs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No recent activities</p>
        ) : (
          <div className="space-y-3">
            {logs.slice(0, 10).map((log, idx) => {
              const date = new Date(log.createdAt);
              const actionType = log.action.includes("Created")
                ? "created"
                : log.action.includes("Updated")
                ? "updated"
                : "deleted";
              const colors = {
                created: "bg-green-100 text-green-800",
                updated: "bg-blue-100 text-blue-800",
                deleted: "bg-red-100 text-red-800",
              };
              return (
                <div key={idx} className="flex items-center gap-4 pb-3 border-b last:border-b-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[actionType]}`}>
                    {actionType.toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{log.action}</p>
                    <p className="text-sm text-gray-600">{log.performedBy}</p>
                  </div>
                  <span className="text-xs text-gray-500">{date.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* System Health */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4 text-gray-800">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm text-gray-600">Database</p>
              <p className="font-semibold text-gray-800">Connected</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm text-gray-600">Server</p>
              <p className="font-semibold text-gray-800">Running</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm text-gray-600">API</p>
              <p className="font-semibold text-gray-800">Operational</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState, useContext } from "react";
import { motion } from "framer-motion";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { socket } from "../services/socket";
import { ProfessionalIcon } from "../components/ProfessionalIcons";
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
        user?.role === "Admin" ? axios.get("/audit") : Promise.resolve({ data: { data: [] } }),
      ]);

      setAssets(assetsRes.data.assets || assetsRes.data || []);
      setLogs(logsRes.data?.data || logsRes.data || []);
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

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

  const statusData = [
    { name: "Available", value: stats.available },
    { name: "Assigned", value: stats.assigned },
    { name: "Maintenance", value: stats.maintenance },
    { name: "Retired", value: stats.retired },
  ];

  const COLORS = [
    theme.colors.accent.success,
    theme.colors.primary[600],
    theme.colors.accent.warning,
    theme.colors.accent.error,
  ];

  const assetTypeData = assets.reduce((acc, asset) => {
    const existing = acc.find((item) => item.name === asset.type);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: asset.type, value: 1 });
    }
    return acc;
  }, []);

  const recentActivities = logs.slice(0, 5).map((log) => ({
    action: log.action,
    user: log.performedBy,
    time: new Date(log.createdAt).toLocaleTimeString(),
  }));

  const assetHealth = {
    compliant: assets.filter((a) => a.status !== "retired").length,
    noncompliant: assets.filter((a) => a.status === "retired").length,
    totalAssets: assets.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-900 to-teal-900">
        <motion.div
          className="text-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div
            className="w-16 h-16 border-4 border-teal-400/20 border-t-teal-400 rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-teal-200 font-semibold text-lg">Loading Dashboard...</p>
        </motion.div>
      </div>
    );
  }

  const metricCards = [
    { label: "Total Assets", value: stats.totalAssets, color: theme.colors.primary[500], delay: 0 },
    { label: "Available", value: stats.available, color: theme.colors.accent.success, delay: 0.1 },
    { label: "Assigned", value: stats.assigned, color: theme.colors.primary[600], delay: 0.2 },
    { label: "Maintenance", value: stats.maintenance, color: theme.colors.accent.warning, delay: 0.3 },
    { label: "Retired", value: stats.retired, color: theme.colors.accent.error, delay: 0.4 },
  ];

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 pb-10">
        <ToastContainer position="top-right" autoClose={3000} />

        {/* Welcome Section */}
        <motion.div
          className="mb-8 px-6 pt-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-1">
            Overview
          </h1>
          <p className="text-gray-400 text-sm font-medium">
            Good to see you, {user?.name}. Here's what's happening.
          </p>
        </motion.div>

        {/* Key Metrics - 3D Cards */}
        <div className="px-6 mb-10">
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {metricCards.map((metric, idx) => (
              <div className="card" key={idx}>
                <motion.div
                  className="relative overflow-hidden rounded-2xl p-6 h-full"
                  style={{
                    border: '1px solid rgba(255,255,255,0.03)',
                    background: `linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))`
                  }}
                >
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <p className="text-gray-400 text-sm font-medium mb-1">{metric.label}</p>
                      <motion.p
                        className="text-3xl font-semibold text-white tracking-tight"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: metric.delay + 0.1 }}
                      >
                        {metric.value}
                      </motion.p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-800/50">
                      <span className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: metric.color }}></span>
                        Live metric
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="px-6 mb-10">
          <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Asset Status Distribution */}
            <div className="card">
              <motion.div className="p-6">
                <h2 className="text-sm font-semibold text-gray-300 mb-6 uppercase tracking-wider">
                  Asset Distribution
                </h2>
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
                      <Tooltip
                        contentStyle={{
                          background: "rgba(0, 0, 0, 0.8)",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          borderRadius: "8px"
                        }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* Asset Types Bar Chart */}
            <div className="card">
              <motion.div className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    ⬚
                  </motion.div>
                  Asset Types
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assetTypeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                      <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.6)" />
                      <YAxis stroke="rgba(255, 255, 255, 0.6)" />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(0, 0, 0, 0.8)",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          borderRadius: "8px"
                        }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Bar dataKey="value" fill="#00897B" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Admin Section */}
        {user?.role === "Admin" && (
          <div className="px-6 mb-10">
            <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Audit Stats */}
              <div className="card">
                <motion.div className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Audit Metrics</h3>
                  <motion.div className="space-y-4">
                    {[
                      { label: "Total Logs", value: stats.totalLogs },
                      { label: "Today's Logs", value: stats.todayLogs },
                      { label: "Active Users", value: stats.uniqueUsers },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10"
                        whileHover={{ x: 4 }}
                      >
                        <span className="text-purple-100 font-medium">{item.label}</span>
                        <motion.span
                          className="text-2xl font-bold text-purple-200"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring" }}
                        >
                          {item.value}
                        </motion.span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              </div>

              {/* Asset Health */}
              <div className="card">
                <motion.div className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Asset Health</h3>
                  <motion.div className="space-y-4">
                    {[
                      { label: "Compliant", value: assetHealth.compliant, color: "indigo" },
                      { label: "Non-Compliant", value: assetHealth.noncompliant, color: "indigo" },
                      { label: "Total", value: assetHealth.totalAssets, color: "indigo" },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10"
                        whileHover={{ x: 4 }}
                      >
                        <span className="text-indigo-100 font-medium">{item.label}</span>
                        <motion.span
                          className="text-2xl font-bold text-indigo-200"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: i * 0.1 }}
                        >
                          {item.value}
                        </motion.span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              </div>

              {/* Quick Actions */}
              <div className="card">
                <motion.div className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                  <div className="space-y-2 flex-1">
                    {[
                      { label: "Add Asset", href: "/assets" },
                      { label: "View Logs", href: "/audit-logs" },
                      { label: "Settings", href: "/settings" },
                    ].map((action, i) => (
                      <motion.a
                        key={i}
                        href={action.href}
                        className="block w-full bg-emerald-500/30 hover:bg-emerald-500/50 text-white py-2.5 px-4 rounded-lg transition font-semibold border border-emerald-500/50"
                        whileHover={{ scale: 1.05, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.9 + i * 0.1 }}
                      >
                        {action.label}
                      </motion.a>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Recent Activities */}
        <div className="px-6 mb-10">
          <div className="card">
            <motion.div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Recent Activities</h2>
              {logs.length === 0 ? (
                <motion.p className="text-blue-100 text-center py-8">
                  No recent activities
                </motion.p>
              ) : (
                <div className="space-y-2">
                  {logs.slice(0, 10).map((log, idx) => {
                    const date = new Date(log.createdAt);
                    const actionType = log.action.includes("Created")
                      ? "created"
                      : log.action.includes("Updated")
                        ? "updated"
                        : "deleted";
                    const colors = {
                      created: "from-green-500/30 to-green-600/30 border-green-500/30",
                      updated: "from-blue-500/30 to-blue-600/30 border-blue-500/30",
                      deleted: "from-red-500/30 to-red-600/30 border-red-500/30",
                    };
                    return (
                      <motion.div
                        key={idx}
                        className={`flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r ${colors[actionType]} border backdrop-blur-md`}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 1 + idx * 0.05 }}
                        whileHover={{ x: 4 }}
                      >
                        <motion.span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${actionType === "created"
                            ? "bg-green-500/50 text-green-100"
                            : actionType === "updated"
                              ? "bg-blue-500/50 text-blue-100"
                              : "bg-red-500/50 text-red-100"
                            }`}
                          whileHover={{ scale: 1.1 }}
                        >
                          {actionType.toUpperCase()}
                        </motion.span>
                        <div className="flex-1">
                          <p className="font-semibold text-white">{log.action}</p>
                          <p className="text-sm text-blue-200">{log.performedBy}</p>
                        </div>
                        <span className="text-xs text-blue-300 whitespace-nowrap">{date.toLocaleString()}</span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* System Status */}
        <div className="px-6">
          <div className="card">
            <motion.div className="p-6">
              <h2 className="text-xl font-bold text-white mb-6">System Status</h2>
              <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: "Database", status: "Connected" },
                  { name: "Server", status: "Running" },
                  { name: "API", status: "Operational" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/10"
                    whileHover={{ scale: 1.05 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1 + i * 0.1 }}
                  >
                    <motion.div
                      className="w-3 h-3 bg-green-400 rounded-full"
                      animate={{ boxShadow: ["0 0 10px rgba(74, 222, 128, 0.5)", "0 0 20px rgba(74, 222, 128, 1)"] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <div>
                      <p className="text-sm text-blue-200">{item.name}</p>
                      <p className="font-semibold text-green-300">{item.status}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

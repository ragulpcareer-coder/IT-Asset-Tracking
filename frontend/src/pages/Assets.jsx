import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import AssetModal from "../components/AssetModal";
import AssetTable from "../components/AssetTable";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { socket } from "../services/socket";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useDropzone } from "react-dropzone";

import { useLocation } from "react-router-dom";

export default function Assets() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [assets, setAssets] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);

  // Initialize search from URL if present
  const initialSearch = new URLSearchParams(window.location.search).get("search") || "";
  const [search, setSearch] = useState(initialSearch);

  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(false);

  // Sync search state if URL changes externally
  useEffect(() => {
    const querySearch = new URLSearchParams(location.search).get("search");
    if (querySearch !== null && querySearch !== search) {
      setSearch(querySearch);
    }
  }, [location.search]);

  useEffect(() => {
    fetchAssets();
    if (window.location.search.includes("add=true")) {
      setEditingAsset(null);
      setIsModalOpen(true);
      // Clean up URL without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [search, statusFilter, typeFilter, sortBy]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "All") params.append("status", statusFilter);
      if (typeFilter !== "All") params.append("type", typeFilter);
      if (sortBy) params.append("sort", sortBy);

      const res = await axios.get(`/assets?${params.toString()}`);
      setAssets(res.data.assets || []);
    } catch (error) {
      toast.error("Failed to fetch assets");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (formData) => {
    try {
      if (editingAsset) {
        await axios.put(`/assets/${editingAsset._id}`, formData);
        toast.success("Asset updated successfully");
      } else {
        await axios.post("/assets", formData);
        toast.success("Asset created successfully");
      }
      setIsModalOpen(false);
      setEditingAsset(null);
      fetchAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this asset?")) {
      try {
        await axios.delete(`/assets/${id}`);
        toast.success("Asset deleted successfully");
        fetchAssets();
      } catch (error) {
        toast.error("Failed to delete asset");
      }
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("IT Asset Inventory Report", 14, 15);

    const tableColumn = ["Name", "Type", "Serial", "Status", "Price", "Life(Yrs)", "Assigned"];
    const tableRows = [];

    assets.forEach(asset => {
      const assetData = [
        asset.name,
        asset.type,
        asset.serialNumber,
        asset.status,
        `$${asset.purchasePrice || 0}`,
        asset.usefulLifeYears || 5,
        asset.assignedTo || "None"
      ];
      tableRows.push(assetData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });

    doc.save(`assets_report_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF Exported Successfully");
  };

  const handleExport = () => {
    const csvContent = [
      ["Name", "Type", "Serial Number", "Status", "Assigned To", "Created At"],
      ...assets.map((a) => [
        a.name,
        a.type,
        a.serialNumber,
        a.status,
        a.assignedTo || "-",
        new Date(a.createdAt).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const element = document.createElement("a");
    element.setAttribute("href", `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`);
    element.setAttribute("download", `assets_${new Date().toISOString().split("T")[0]}.csv`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Exported successfully");
  };

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post("/assets/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(res.data.message);
      if (res.data.errors?.length > 0) {
        console.warn("Bulk Upload Errors:", res.data.errors);
        toast.warning(`Uploaded. ${res.data.errors.length} skipped. See console.`);
      }
      fetchAssets();
    } catch (err) {
      toast.error("Failed to upload bulk CSV");
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    noClick: true, // We will trigger it via a button
    noKeyboard: true
  });

  const openEditModal = (asset) => {
    setEditingAsset(asset);
    setIsModalOpen(true);
  };

  const getAssetTypes = () => {
    const types = [...new Set(assets.map((a) => a.type))];
    return types.filter((t) => t);
  };

  const stats = {
    total: assets.length,
    available: assets.filter((a) => a.status === "available").length,
    assigned: assets.filter((a) => a.status === "assigned").length,
    maintenance: assets.filter((a) => a.status === "maintenance").length,
    retired: assets.filter((a) => a.status === "retired").length,
  };

  return (
    <div className="min-h-screen relative pb-10 text-white">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 px-4 md:px-2"
        >
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight mb-1">
              Assets
            </h1>
            <p className="text-gray-400 text-sm font-medium">Manage and monitor hardware</p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={handleExportPDF}
              disabled={assets.length === 0}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-5 py-2.5 rounded-lg transition-all text-sm font-medium"
            >
              Export PDF
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExport}
              disabled={assets.length === 0}
              className="bg-[#111] hover:bg-[#222] border border-white/10 text-white px-5 py-2.5 rounded-lg transition-all text-sm font-medium"
            >
              Export CSV
            </motion.button>
            {["Super Admin", "Admin"].includes(user?.role) && (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const el = document.getElementById("csv-upload");
                    if (el) el.click();
                  }}
                  className="bg-[#111] hover:bg-[#222] border border-white/10 text-white px-5 py-2.5 rounded-lg transition-all text-sm font-medium"
                >
                  Bulk Upload CSV
                </motion.button>
                <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={(e) => onDrop(e.target.files)} />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setEditingAsset(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-white hover:bg-gray-100 text-black px-5 py-2.5 rounded-lg transition-all text-sm font-medium"
                >
                  + New Asset
                </motion.button>
              </>
            )}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-8 px-4 md:px-0"
        >
          {[
            { label: "Total", value: stats.total },
            { label: "Available", value: stats.available },
            { label: "Assigned", value: stats.assigned },
            { label: "Maintenance", value: stats.maintenance },
            { label: "Retired", value: stats.retired },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl">
              <p className="text-xs font-medium text-gray-500 mb-2">{stat.label}</p>
              <p className="text-2xl font-semibold text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Filters Panel */}
        <div className="mb-6 bg-[#0a0a0a] border border-white/10 rounded-xl p-4 mx-4 md:mx-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <input
                type="text"
                placeholder="Search assets..."
                className="w-full bg-[#111] border border-white/10 text-white caret-white p-2.5 rounded-lg focus:ring-1 focus:ring-white outline-none transition-all placeholder-gray-600 text-sm"
                style={{ color: 'white' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="w-full bg-[#111] border border-white/10 text-white p-2.5 rounded-lg focus:ring-1 focus:ring-white outline-none transition-all text-sm appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
            <select
              className="w-full bg-[#111] border border-white/10 text-white p-2.5 rounded-lg focus:ring-1 focus:ring-white outline-none transition-all text-sm appearance-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {getAssetTypes().map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              className="w-full bg-[#111] border border-white/10 text-white p-2.5 rounded-lg focus:ring-1 focus:ring-white outline-none transition-all text-sm appearance-none"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="createdAt">Sort: Date Added</option>
              <option value="status">Sort: Status</option>
            </select>
          </div>
        </div>

        {/* Data Matrix (Table) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {loading ? (
            <div className="py-20">
              <LoadingSpinner message="Loading assets..." />
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <AssetTable
                assets={assets}
                onEdit={["Super Admin", "Admin"].includes(user?.role) ? openEditModal : null}
                onDelete={["Super Admin", "Admin"].includes(user?.role) ? handleDelete : null}
                user={user}
              />
            </div>
          )}
        </motion.div>
      </div>

      <AssetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        initialData={editingAsset}
      />
    </div>
  );
}

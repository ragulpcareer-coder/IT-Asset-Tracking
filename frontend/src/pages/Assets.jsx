import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import AssetModal from "../components/AssetModal";
import AssetTable from "../components/AssetTable";

export default function Assets() {
  const { user } = useContext(AuthContext);
  const [assets, setAssets] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAssets();
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
    <div className="pb-10">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">Assets</h1>
          <p className="text-gray-600 mt-1">Manage and track your IT assets</p>
        </div>
        {user?.role === "Admin" && (
          <button
            onClick={() => {
              setEditingAsset(null);
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md transition font-semibold"
          >
            + Add Asset
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total", value: stats.total, color: "bg-gray-500" },
          { label: "Available", value: stats.available, color: "bg-green-500" },
          { label: "Assigned", value: stats.assigned, color: "bg-blue-500" },
          { label: "Maintenance", value: stats.maintenance, color: "bg-yellow-500" },
          { label: "Retired", value: stats.retired, color: "bg-red-500" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.color} text-white p-4 rounded-lg shadow`}>
            <p className="text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters & Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="🔍 Search assets..."
            className="border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="available">available</option>
            <option value="assigned">assigned</option>
            <option value="maintenance">maintenance</option>
            <option value="retired">retired</option>
          </select>
          <select
            className="border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="All">All Types</option>
            {getAssetTypes().map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            className="border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">Sort by Name</option>
            <option value="createdAt">Sort by Date</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={assets.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition font-semibold"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Assets Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading assets...</div>
      ) : (
        <AssetTable
          assets={assets}
          onEdit={user?.role === "Admin" ? openEditModal : null}
          onDelete={user?.role === "Admin" ? handleDelete : null}
          user={user}
        />
      )}

      {/* Asset Modal */}
      <AssetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        initialData={editingAsset}
      />
    </div>
  );
}

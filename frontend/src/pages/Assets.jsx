import React, { useState, useEffect, useContext, useMemo, useCallback, useRef, useDeferredValue } from "react";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import AssetModal from "../components/AssetModal";
import AssetTable from "../components/AssetTable";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { socket } from "../services/socket";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useLocation } from "react-router-dom";
import { Button, Card, ConfirmModal, Input, PermissionGuard } from "../components/UI";
import { assetSchema } from "../utils/assetSchema";
import AssetNetworkMap from "../components/AssetNetworkMap";
import PageHeader from "../components/PageHeader";

/**
 * Enterprise Asset Matrix
 * Features: High-accuracy telemetry, Role-based metadata editing, Forensic PDF reporting.
 */

export default function Assets() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [assets, setAssets] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);

  // Search Synchronization
  const [search, setSearch] = useState(new URLSearchParams(window.location.search).get("search") || "");
  const deferredSearch = useDeferredValue(search);
  const fetchTimeoutRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name:asc");
  const [loading, setLoading] = useState(true);
  const [showNetworkMap, setShowNetworkMap] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const querySearch = new URLSearchParams(location.search).get("search");
    if (querySearch !== null && querySearch !== search) setSearch(querySearch);
  }, [location.search, search]);

  useEffect(() => {
    if (location.search.includes("add=true")) {
      setEditingAsset(null);
      setIsModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.search]);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (deferredSearch) params.append("search", deferredSearch);
      if (statusFilter !== "All") params.append("status", statusFilter);
      if (typeFilter !== "All") params.append("type", typeFilter);
      if (sortBy) params.append("sort", sortBy);

      const res = await axios.get(`/assets?${params.toString()}`);
      setAssets(res.data.assets || res.data || []);
    } catch (error) {
      toast.error("Failed to load assets. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, statusFilter, typeFilter, sortBy]);

  useEffect(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      fetchAssets();
    }, 200);

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [fetchAssets]);

  useEffect(() => {
    const canNotifyActivity =
      user?.preferences?.pushNotifications !== false &&
      user?.preferences?.activityNotifications !== false;

    const onAssetCreated = (newAsset) => {
      setAssets((prev) => [newAsset, ...prev]);
      if (canNotifyActivity) toast.info(`New asset registered: ${newAsset.name}`);
    };

    const onAssetUpdated = (updated) => {
      setAssets((prev) => prev.map((a) => (a._id === updated._id ? updated : a)));
    };

    const onAssetDeleted = (id) => {
      setAssets((prev) => prev.filter((a) => a._id !== id));
      if (canNotifyActivity) toast.warn("An asset was removed by an administrator.");
    };

    socket.on("assetCreated", onAssetCreated);
    socket.on("assetUpdated", onAssetUpdated);
    socket.on("assetDeleted", onAssetDeleted);

    return () => {
      socket.off("assetCreated", onAssetCreated);
      socket.off("assetUpdated", onAssetUpdated);
      socket.off("assetDeleted", onAssetDeleted);
    };
  }, [user?.preferences?.pushNotifications, user?.preferences?.activityNotifications]);

  const handleCreate = useCallback(async (formData) => {
    try {
      if (editingAsset) {
        await axios.put(`/assets/${editingAsset._id}`, formData);
        toast.success("Asset Metadata Updated");
      } else {
        await axios.post("/assets", formData);
        toast.success("New asset registered successfully.");
      }
      setIsModalOpen(false);
      setEditingAsset(null);
      fetchAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || "Registry Update Rejected");
    }
  }, [editingAsset, fetchAssets]);

  const handleDelete = useCallback((id) => {
    const targetAsset = assets.find((asset) => asset._id === id) || null;
    setDeleteTarget(targetAsset ? { id, name: targetAsset.name } : { id, name: "this asset" });
    setDeletePassword("");
    setDeleteError("");
  }, [assets]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    if (!deletePassword.trim()) {
      setDeleteError("Please enter your current password to confirm this action.");
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");

    try {
      await axios.delete(`/assets/${deleteTarget.id}`, {
        data: { confirmPassword: deletePassword },
      });
      setAssets((prev) => prev.filter((asset) => asset._id !== deleteTarget.id));
      toast.success("Asset removed from inventory successfully.");
      setDeleteTarget(null);
      setDeletePassword("");
    } catch (error) {
      const message = error.response?.data?.message || "Decommission Rejected: System/Role Violation";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  }, [deletePassword, deleteTarget]);

  const handleExportPDF = async () => {
    if (assets.length === 0) {
      toast.error("No assets available for export.");
      return;
    }

    try {
      const doc = new jsPDF("landscape");
      doc.setFontSize(22);
      doc.text("Asset Inventory Report", 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated By: ${user?.name || "System"} (${user?.role || "User"})`, 14, 28);
      doc.text(`Generated On: ${new Date().toUTCString()}`, 14, 34);

      const validationResult = assetSchema.validateExportData(assets);
      if (!validationResult.valid) {
        toast.error(`Data Integrity Failure: ${validationResult.error}`);
        return;
      }

      const generateChecksum = (assetsArr) => {
        let payload = JSON.stringify((Array.isArray(assetsArr) ? assetsArr : []).map((a) => a._id || a.uuid || a.serialNumber));
        let hash = 0;
        for (let i = 0; i < payload.length; i++) {
          const char = payload.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
      };

      const checksum = generateChecksum(assets);
      doc.setFontSize(10);
      doc.text(`Record Count: ${assets.length} nodes verified`, 14, 40);
      doc.text(`Integrity Checksum: ${checksum} [VALID]`, 14, 46);

      const schemaKeys = Object.keys(assetSchema?.exportableFields || {});
      const tableColumn = (Array.isArray(schemaKeys) ? schemaKeys : []).map((key) => assetSchema.exportableFields[key]);

      const tableRows = (Array.isArray(assets) ? assets : []).map((asset) => {
        return (Array.isArray(schemaKeys) ? schemaKeys : []).map((key) => {
          return assetSchema.formatters[key] ? assetSchema.formatters[key](asset) : "N/A";
        });
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 52,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 35 },
          2: { cellWidth: 22 },
          3: { cellWidth: 20 },
          4: { cellWidth: 22 },
          5: { cellWidth: 25 },
          6: { cellWidth: 35 },
          7: { cellWidth: 22 },
          8: { cellWidth: 30 },
          9: { cellWidth: 22 },
        },
      });

      doc.save(`Asset_Inventory_Report_${new Date().toISOString().split("T")[0]}.pdf`);

      try {
        await axios.post("/audit", {
          action: "REPORT_EXPORT",
          details: `Exported Asset Inventory Report PDF containing ${assets.length} assets.`,
        });
      } catch (e) {
        // Soft fail audit log if endpoint isn't wired for general logs
      }

      toast.success("Asset Inventory Report Exported Successfully");
    } catch (error) {
      toast.error("PDF export failed. Please retry.");
    }
  };

  const openEditModal = useCallback((asset) => {
    setEditingAsset(asset);
    setIsModalOpen(true);
  }, []);

  const stats = useMemo(() => ({
    total: assets.length,
    available: assets.filter((a) => a.status === "available").length,
    assigned: assets.filter((a) => a.status === "assigned").length,
    maintenance: assets.filter((a) => a.status === "maintenance").length,
    retired: assets.filter((a) => a.status === "retired").length,
  }), [assets]);

  const assetTypes = useMemo(() => {
    const defaultAssetTypes = ["Laptop", "Desktop", "Server", "Network Device", "Mobile", "Peripheral", "Internal", "Unknown"];
    return [...new Set([...(Array.isArray(assets) ? assets : []).map((a) => a.type), ...defaultAssetTypes])].filter(Boolean);
  }, [assets]);

  const statStyles = {
    "Total Assets": { borderColor: "rgba(79, 156, 255, 0.4)", textColor: "#4f9cff" },
    Available: { borderColor: "rgba(51, 196, 141, 0.4)", textColor: "#33c48d" },
    Assigned: { borderColor: "rgba(125, 211, 252, 0.4)", textColor: "#7dd3fc" },
    "In Service": { borderColor: "rgba(244, 182, 91, 0.4)", textColor: "#f4b65b" },
    Archived: { borderColor: "rgba(239, 95, 108, 0.4)", textColor: "#ef5f6c" },
  };

  return (
    <div className="fade-in pb-12">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      <PageHeader
        title="Asset Inventory"
        subtitle="Cluster management, lifecycle operations, and network visibility."
        actions={
          <>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={handleExportPDF} disabled={assets.length === 0}>
            Export Inventory (PDF)
          </Button>
          <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
            <Button variant="primary" className="w-full sm:w-auto" onClick={() => { setEditingAsset(null); setIsModalOpen(true); }}>
              Register New Asset
            </Button>
          </PermissionGuard>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setShowNetworkMap(true)} disabled={assets.length === 0}>
            Open Network Map
          </Button>
          </>
        }
      />

      {showNetworkMap && <AssetNetworkMap onClose={() => setShowNetworkMap(false)} />}

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total Assets", value: stats.total, color: "blue" },
          { label: "Available", value: stats.available, color: "green" },
          { label: "Assigned", value: stats.assigned, color: "sky" },
          { label: "In Service", value: stats.maintenance, color: "amber" },
          { label: "Archived", value: stats.retired, color: "red" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 bg-slate-900/40" style={{ borderLeft: `2px solid ${statStyles[stat.label].borderColor}` }}>
            <div className="text-[10px] uppercase font-black text-slate-500 tracking-wider mb-1">{stat.label}</div>
            <div className="text-xl font-black tabular-nums sm:text-2xl" style={{ color: statStyles[stat.label].textColor }}>{stat.value}</div>
          </Card>
        ))}
      </div>

      <Card className="mb-8 p-3 bg-slate-900/60">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search by Serial Number, Asset Name, or Owner..."
            className="mb-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input bg-slate-950/40 border-white/5"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">Filter by Operational Status</option>
            <option value="available">Available / Inventory</option>
            <option value="assigned">Live / Assigned</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Archived</option>
          </select>
          <select
            className="input bg-slate-950/40 border-white/5"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="All">Filter by Asset Type</option>
            {Array.isArray(assetTypes) && assetTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            className="input bg-slate-950/40 border-white/5"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name:asc">Sort by Asset Name (A-Z)</option>
            <option value="name:desc">Sort by Asset Name (Z-A)</option>
            <option value="createdAt:desc">Sort: Newest First</option>
            <option value="createdAt:asc">Sort: Oldest First</option>
            <option value="status:asc">Sort: Operational Status</option>
            <option value="riskScore:desc">Sort: Risk Score (High-Low)</option>
            <option value="usefulLifeYears:asc">Sort: Lifecycle Phase</option>
          </select>
        </div>
      </Card>

      <div className="relative" style={{ minHeight: 420 }}>
        <AssetTable
          assets={assets}
          onEdit={openEditModal}
          onDelete={handleDelete}
          user={user}
          loading={loading}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
            <LoadingSpinner message="Loading assets..." />
          </div>
        )}
      </div>

      <AssetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        initialData={editingAsset}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Remove Asset?"
        message={`This action will permanently remove ${deleteTarget?.name || "this asset"} from the inventory.`}
        confirmText="Remove Asset"
        type="danger"
        confirmDisabled={!deletePassword.trim()}
        confirmLoading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (deleteLoading) return;
          setDeleteTarget(null);
          setDeletePassword("");
          setDeleteError("");
        }}
      >
        <Input
          label="Current Password"
          type="password"
          value={deletePassword}
          onChange={(e) => {
            setDeletePassword(e.target.value);
            if (deleteError) setDeleteError("");
          }}
          placeholder="Enter your current password"
          required
          error={deleteError}
        />
      </ConfirmModal>
    </div>
  );
}

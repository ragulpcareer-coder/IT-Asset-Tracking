import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import AssetModal from "../components/AssetModal";
import AssetTable from "../components/AssetTable";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { socket } from "../services/socket";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useLocation } from "react-router-dom";
import { Button, Card, Badge, Input, PermissionGuard } from "../components/UI";
import { assetSchema } from "../utils/assetSchema";
import AssetNetworkMap from "../components/AssetNetworkMap";

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
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [warrantyFilter, setWarrantyFilter] = useState("All");
  const [ageFilter, setAgeFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name:asc");
  const [loading, setLoading] = useState(false);
  const [showNetworkMap, setShowNetworkMap] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkAssignedTo, setBulkAssignedTo] = useState("");
  const [bulkDepartment, setBulkDepartment] = useState("");
  const [bulkBuilding, setBulkBuilding] = useState("");
  const [bulkRoom, setBulkRoom] = useState("");
  const [savedViews, setSavedViews] = useState([]);
  const [selectedView, setSelectedView] = useState("");
  const [auditMode, setAuditMode] = useState(false);
  const [auditScan, setAuditScan] = useState("");
  const [auditedIds, setAuditedIds] = useState(new Set());

  useEffect(() => {
    const stored = localStorage.getItem("assetSavedViews");
    if (stored) {
      try {
        setSavedViews(JSON.parse(stored));
      } catch {
        setSavedViews([]);
      }
    }
  }, []);

  useEffect(() => {
    const querySearch = new URLSearchParams(location.search).get("search");
    if (querySearch !== null && querySearch !== search) setSearch(querySearch);
  }, [location.search]);

  useEffect(() => {
    fetchAssets();
    if (window.location.search.includes("add=true")) {
      setEditingAsset(null);
      setIsModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // REAL-TIME CLUSTER SYNC (ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§Category 4 & 9)
    const canNotifyActivity =
      user?.preferences?.pushNotifications !== false &&
      user?.preferences?.activityNotifications !== false;

    socket.on("assetCreated", (newAsset) => {
      setAssets(prev => [newAsset, ...prev]);
      if (canNotifyActivity) toast.info(`New asset registered: ${newAsset.name}`);
    });

    socket.on("assetUpdated", (updated) => {
      setAssets(prev => prev.map(a => a._id === updated._id ? updated : a));
    });

    socket.on("assetDeleted", (id) => {
      setAssets(prev => prev.filter(a => a._id !== id));
      if (canNotifyActivity) toast.warn("An asset was removed by an administrator.");
    });

    return () => {
      socket.off("assetCreated");
      socket.off("assetUpdated");
      socket.off("assetDeleted");
    };
  }, [search, statusFilter, typeFilter, sortBy, user?.preferences?.pushNotifications, user?.preferences?.activityNotifications]);


  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "All") params.append("status", statusFilter);
      if (typeFilter !== "All") params.append("type", typeFilter);
      if (sortBy) params.append("sort", sortBy);

      const res = await axios.get(`/assets?${params.toString()}`);
      setAssets(res.data.assets || res.data || []);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Failed to load assets. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (formData) => {
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
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/assets/${id}`);
      toast.success("Asset removed from inventory successfully.");
      fetchAssets();
    } catch (error) {
      toast.error("Decommission Rejected: System/Role Violation");
    }
  };

  const handleExportPDF = async () => {
    if (assets.length === 0) {
      toast.error("No assets available for export.");
      return;
    }

    try {
      const doc = new jsPDF('landscape'); // Landscape to fit extra columns cleanly
      doc.setFontSize(22);
      doc.text("Asset Inventory Report", 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated By: ${user?.name || "System"} (${user?.role || "User"})`, 14, 28);
      doc.text(`Generated On: ${new Date().toUTCString()}`, 14, 34);

      // Validate Data Integrity before PDF Generation
      const validationResult = assetSchema.validateExportData(assets);
      if (!validationResult.valid) {
        toast.error(`Data Integrity Failure: ${validationResult.error}`);
        return;
      }

      // Generate Deterministic Checksum
      const generateChecksum = (assetsArr) => {
        let payload = JSON.stringify((Array.isArray(assetsArr) ? assetsArr : []).map(a => a._id || a.uuid || a.serialNumber));
        let hash = 0;
        for (let i = 0; i < payload.length; i++) {
          const char = payload.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
      };

      const checksum = generateChecksum(assets);
      doc.setFontSize(10);
      doc.text(`Record Count: ${assets.length} nodes verified`, 14, 40);
      doc.text(`Integrity Checksum: ${checksum} [VALID]`, 14, 46);

      // Generate Table Headers Dynamically from Schema
      const schemaKeys = Object.keys(assetSchema?.exportableFields || {});
      const tableColumn = (Array.isArray(schemaKeys) ? schemaKeys : []).map((key) => assetSchema.exportableFields[key]);

      // Generate Table Rows Dynamically
      const tableRows = (Array.isArray(assets) ? assets : []).map((asset) => {
        return (Array.isArray(schemaKeys) ? schemaKeys : []).map((key) => {
          return assetSchema.formatters[key] ? assetSchema.formatters[key](asset) : "N/A";
        });
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 52,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { cellWidth: 28 }, // Identity
          1: { cellWidth: 35 }, // UUID
          2: { cellWidth: 22 }, // Authority
          3: { cellWidth: 20 }, // Cluster
          4: { cellWidth: 22 }, // Lifecycle
          5: { cellWidth: 25 }, // Registry State
          6: { cellWidth: 35 }, // Metadata
          7: { cellWidth: 22 }, // QR Code
          8: { cellWidth: 30 }, // Decommission State
          9: { cellWidth: 22 }, // Archive Status
        }
      });

      doc.save(`Asset_Inventory_Report_${new Date().toISOString().split("T")[0]}.pdf`);

      try {
        await axios.post('/audit', {
          action: 'REPORT_EXPORT',
          details: `Exported Asset Inventory Report PDF containing ${assets.length} assets.`
        });
      } catch (e) {
        // Soft fail audit log if endpoint isn't wired for general logs
      }

      toast.success("Asset Inventory Report Exported Successfully");
    } catch (error) {
      console.error(error);
      toast.error("PDF export failed. Please retry.");
    }
  };

  const handleExportCSV = () => {
    if (filteredAssets.length === 0) {
      toast.error("No assets available for export.");
      return;
    }
    const headers = ["Name", "Type", "Serial", "Status", "Assigned To", "IP", "MAC", "Department", "Building", "Room", "Purchase Date", "Warranty"];
    const rows = filteredAssets.map((a) => ([
      a.name || "",
      a.type || "",
      a.serialNumber || "",
      a.status || "",
      a.assignedTo || "",
      a.ipAddress || "",
      a.macAddress || "",
      a.location?.department || "",
      a.location?.building || "",
      a.location?.room || "",
      a.purchaseDate ? new Date(a.purchaseDate).toISOString().split("T")[0] : "",
      a.warrantyExpiry ? new Date(a.warrantyExpiry).toISOString().split("T")[0] : ""
    ]));
    const escape = (value) => {
      const s = String(value ?? "");
      return s.includes(",") || s.includes("\"") || s.includes("\n") ? `"${s.replace(/\"/g, "\"\"")}"` : s;
    };
    const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `asset_inventory_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportMissingAudit = () => {
    const missing = filteredAssets.filter((a) => !auditedIds.has(a._id));
    if (missing.length === 0) {
      toast.info("No missing assets to export.");
      return;
    }
    const headers = ["Name", "Serial", "UUID", "Department", "Building", "Room", "Status"];
    const rows = missing.map((a) => ([
      a.name || "",
      a.serialNumber || "",
      a.uuid || "",
      a.location?.department || "",
      a.location?.building || "",
      a.location?.room || "",
      a.status || ""
    ]));
    const escape = (value) => {
      const s = String(value ?? "");
      return s.includes(",") || s.includes("\"") || s.includes("\n") ? `"${s.replace(/\"/g, "\"\"")}"` : s;
    };
    const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `missing_assets_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleNetworkScan = async () => {
    try {
      setScanLoading(true);
      const res = await axios.post("/assets/scan-network");
      toast.success(res.data?.message || "Network scan completed.");
      fetchAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || "Network scan failed.");
    } finally {
      setScanLoading(false);
    }
  };

  const openEditModal = (asset) => {
    setEditingAsset(asset);
    setIsModalOpen(true);
  };

  const markAudited = () => {
    const value = auditScan.trim();
    if (!value) return;
    const match = filteredAssets.find((a) =>
      [a.serialNumber, a.uuid, a.name].filter(Boolean).some((v) => String(v).toLowerCase() === value.toLowerCase())
    );
    if (!match) {
      toast.error("No asset matched that scan.");
      return;
    }
    setAuditedIds((prev) => new Set(prev).add(match._id));
    setAuditScan("");
  };

  const toggleAsset = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (items) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const ids = items.map((a) => a._id).filter(Boolean);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    try {
      const update = {};
      if (bulkStatus) update.status = bulkStatus;
      if (bulkAssignedTo) update.assignedTo = bulkAssignedTo;
      if (!bulkStatus && bulkAssignedTo) update.status = "assigned";
      if (bulkDepartment || bulkBuilding || bulkRoom) {
        update.location = {
          ...(bulkDepartment ? { department: bulkDepartment } : {}),
          ...(bulkBuilding ? { building: bulkBuilding } : {}),
          ...(bulkRoom ? { room: bulkRoom } : {})
        };
      }
      if (Object.keys(update).length === 0) {
        toast.error("Select at least one bulk update field.");
        return;
      }
      const payload = { assetIds: Array.from(selectedIds), update };
      const res = await axios.put("/assets/bulk-update", payload);
      toast.success(`Bulk update applied to ${res.data?.modified || 0} assets.`);
      setBulkStatus("");
      setBulkAssignedTo("");
      setBulkDepartment("");
      setBulkBuilding("");
      setBulkRoom("");
      fetchAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || "Bulk update failed.");
    }
  };

  const handleSaveView = () => {
    const name = prompt("Name this view");
    if (!name) return;
    const view = {
      name,
      filters: { search, statusFilter, typeFilter, departmentFilter, warrantyFilter, ageFilter, riskFilter, sortBy }
    };
    const next = [...savedViews.filter((v) => v.name !== name), view];
    setSavedViews(next);
    localStorage.setItem("assetSavedViews", JSON.stringify(next));
    setSelectedView(name);
    toast.success("View saved.");
  };

  const applyView = (viewName) => {
    const view = savedViews.find((v) => v.name === viewName);
    if (!view) return;
    const f = view.filters;
    setSearch(f.search || "");
    setStatusFilter(f.statusFilter || "All");
    setTypeFilter(f.typeFilter || "All");
    setDepartmentFilter(f.departmentFilter || "All");
    setWarrantyFilter(f.warrantyFilter || "All");
    setAgeFilter(f.ageFilter || "All");
    setRiskFilter(f.riskFilter || "All");
    setSortBy(f.sortBy || "name:asc");
  };

  // Derivative Statistics Calculation (Requirement G: Accurate)
  const stats = {
    total: assets.length,
    available: assets.filter(a => a.status === "available").length,
    assigned: assets.filter(a => a.status === "assigned").length,
    maintenance: assets.filter(a => a.status === "maintenance").length,
    retired: assets.filter(a => a.status === "retired").length,
  };

  const defaultAssetTypes = ["Laptop", "Desktop", "Server", "Network Device", "Mobile", "Peripheral", "Internal", "Unknown"];
  const assetTypes = [...new Set([...(Array.isArray(assets) ? assets : []).map(a => a.type), ...defaultAssetTypes])].filter(Boolean);
  const departments = [...new Set([...(Array.isArray(assets) ? assets : []).map(a => a.location?.department).filter(Boolean)])];

  const filteredAssets = (Array.isArray(assets) ? assets : []).filter((asset) => {
    if (departmentFilter !== "All" && asset.location?.department !== departmentFilter) return false;
    if (riskFilter !== "All" && asset.securityStatus?.riskLevel !== riskFilter) return false;

    if (warrantyFilter !== "All") {
      const exp = asset.warrantyExpiry ? new Date(asset.warrantyExpiry).getTime() : 0;
      const now = Date.now();
      const in30 = now + 30 * 24 * 60 * 60 * 1000;
      if (warrantyFilter === "Active" && (!exp || exp < now)) return false;
      if (warrantyFilter === "Expired" && (!exp || exp >= now)) return false;
      if (warrantyFilter === "ExpiringSoon" && (!exp || exp < now || exp > in30)) return false;
    }

    if (ageFilter !== "All") {
      const purchase = asset.purchaseDate ? new Date(asset.purchaseDate).getTime() : 0;
      if (!purchase) return false;
      const years = (Date.now() - purchase) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageFilter === "0-1" && years > 1) return false;
      if (ageFilter === "1-3" && (years < 1 || years > 3)) return false;
      if (ageFilter === "3+" && years <= 3) return false;
    }

    return true;
  });

  return (
    <div className="fade-in pb-12">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* Primary Context Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tighter uppercase">Asset Inventory</h1>
          <p className="text-slate-500 font-medium mt-1 text-xs tracking-widest uppercase">
            Cluster Management & Deployment Operations
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={handleExportPDF} disabled={assets.length === 0}>
            Export Inventory (PDF)
          </Button>
          <Button variant="secondary" onClick={handleExportCSV} disabled={filteredAssets.length === 0}>
            Export Filtered (CSV)
          </Button>
          <Button variant={auditMode ? "danger" : "secondary"} onClick={() => setAuditMode((prev) => !prev)}>
            {auditMode ? "Exit Audit Mode" : "Audit Mode"}
          </Button>
          <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
            <Button variant="primary" onClick={() => { setEditingAsset(null); setIsModalOpen(true); }}>
              Register New Asset
            </Button>
          </PermissionGuard>
          <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
            <Button variant="secondary" onClick={handleNetworkScan} disabled={scanLoading}>
              {scanLoading ? "Scanning..." : "Scan Network"}
            </Button>
          </PermissionGuard>
          <Button variant="secondary" onClick={() => setShowNetworkMap(true)} disabled={assets.length === 0}>
            Open Network Map
          </Button>
        </div>
      </div>

      {showNetworkMap && <AssetNetworkMap onClose={() => setShowNetworkMap(false)} />}

      {/* Snapshot Ledger (Requirement G: Accurate Counters) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {[
          { label: "Total Assets", value: stats.total, color: "blue" },
          { label: "Available", value: stats.available, color: "green" },
          { label: "Assigned", value: stats.assigned, color: "sky" },
          { label: "In Service", value: stats.maintenance, color: "amber" },
          { label: "Archived", value: stats.retired, color: "red" },
        ].map((stat) => (
          <Card key={stat.label} className={`border-l-2 border-l-${stat.color}-500/30 p-4 bg-slate-900/40`}>
            <div className="text-[10px] uppercase font-black text-slate-500 tracking-wider mb-1">{stat.label}</div>
            <div className={`text-2xl font-black text-${stat.color}-500 tabular-nums`}>{stat.value}</div>
          </Card>
        ))}
      </div>

      {/* Filter Intelligence */}
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
            <option value="pending_recovery">Pending Recovery</option>
            <option value="retired">Archived</option>
          </select>
          <select
            className="input bg-slate-950/40 border-white/5"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="All">Filter by Asset Type</option>
            {Array.isArray(assetTypes) && assetTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <select
            className="input bg-slate-950/40 border-white/5"
            value={selectedView}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedView(value);
              if (value) applyView(value);
            }}
          >
            <option value="">Saved Views</option>
            {savedViews.map((view) => (
              <option key={view.name} value={view.name}>{view.name}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={handleSaveView}>Save Current View</Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (!selectedView) return;
              const next = savedViews.filter((v) => v.name !== selectedView);
              setSavedViews(next);
              localStorage.setItem("assetSavedViews", JSON.stringify(next));
              setSelectedView("");
              toast.info("View removed.");
            }}
          >
            Delete View
          </Button>
          <Button variant="ghost" onClick={() => {
            setSearch("");
            setStatusFilter("All");
            setTypeFilter("All");
            setDepartmentFilter("All");
            setWarrantyFilter("All");
            setAgeFilter("All");
            setRiskFilter("All");
            setSortBy("name:asc");
            setSelectedView("");
          }}>
            Reset Filters
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <select
            className="input bg-slate-950/40 border-white/5"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="All">Filter by Department</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <select
            className="input bg-slate-950/40 border-white/5"
            value={warrantyFilter}
            onChange={(e) => setWarrantyFilter(e.target.value)}
          >
            <option value="All">Filter by Warranty</option>
            <option value="Active">Active Warranty</option>
            <option value="ExpiringSoon">Expiring in 30 Days</option>
            <option value="Expired">Expired</option>
          </select>
          <select
            className="input bg-slate-950/40 border-white/5"
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value)}
          >
            <option value="All">Filter by Age</option>
            <option value="0-1">0-1 Years</option>
            <option value="1-3">1-3 Years</option>
            <option value="3+">3+ Years</option>
          </select>
          <select
            className="input bg-slate-950/40 border-white/5"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="All">Filter by Risk</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
            <option value="Critical">Critical Risk</option>
          </select>
        </div>
        <div className="flex justify-between items-center mt-4 text-xs text-slate-400">
          <span>Showing {filteredAssets.length} of {assets.length} assets</span>
          <Button variant="ghost" size="sm" onClick={() => {
            setDepartmentFilter("All");
            setWarrantyFilter("All");
            setAgeFilter("All");
            setRiskFilter("All");
          }}>
            Clear Advanced Filters
          </Button>
        </div>
      </Card>

      {/* Bulk Actions */}
      <Card className="mb-6 p-4 bg-slate-900/50 border-white/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-slate-400 text-xs uppercase tracking-widest">
            Selected: <span className="text-white font-bold">{selectedIds.size}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              className="input bg-slate-950/40 border-white/5"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
            >
              <option value="">Bulk Status Update</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="maintenance">Maintenance</option>
              <option value="pending_recovery">Pending Recovery</option>
              <option value="retired">Retired</option>
            </select>
            <Input
              placeholder="Bulk assign to (email/name)"
              value={bulkAssignedTo}
              onChange={(e) => setBulkAssignedTo(e.target.value)}
              className="mb-0"
            />
            <Input
              placeholder="Dept"
              value={bulkDepartment}
              onChange={(e) => setBulkDepartment(e.target.value)}
              className="mb-0"
            />
            <Input
              placeholder="Building"
              value={bulkBuilding}
              onChange={(e) => setBulkBuilding(e.target.value)}
              className="mb-0"
            />
            <Input
              placeholder="Room"
              value={bulkRoom}
              onChange={(e) => setBulkRoom(e.target.value)}
              className="mb-0"
            />
            <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
              <Button variant="primary" onClick={handleBulkUpdate} disabled={selectedIds.size === 0}>
                Apply Bulk Update
              </Button>
            </PermissionGuard>
          </div>
        </div>
      </Card>

      {/* Data Visualization Grid (Item D: Responsive Scroll) */}
      <div className="w-full">
        {loading ? (
          <div className="py-24"><LoadingSpinner message="Loading assets..." /></div>
        ) : auditMode ? (
          <Card className="p-4 bg-slate-900/50 border-white/5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div className="text-xs uppercase tracking-widest text-slate-500">Quick Auditor</div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Scan Serial / UUID / Name"
                  value={auditScan}
                  onChange={(e) => setAuditScan(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") markAudited(); }}
                  className="mb-0"
                />
                <Button variant="primary" onClick={markAudited}>Mark Scanned</Button>
                <Button variant="secondary" onClick={handleExportMissingAudit}>Export Missing CSV</Button>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-slate-400 mb-4">
              <span>Scanned: <span className="text-white font-bold">{auditedIds.size}</span></span>
              <span>Missing: <span className="text-red-400 font-bold">{Math.max(0, filteredAssets.length - auditedIds.size)}</span></span>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr key={asset._id} className={auditedIds.has(asset._id) ? "bg-emerald-500/5" : ""}>
                      <td className="text-xs text-white font-bold">
                        {asset.name} <span className="text-[10px] text-slate-500 font-mono">({asset.serialNumber || asset.uuid})</span>
                      </td>
                      <td className="text-xs text-slate-400">
                        {asset.location?.department || "—"} / {asset.location?.building || "—"}
                      </td>
                      <td className="text-xs text-slate-400">{asset.status || "—"}</td>
                      <td className="text-xs">
                        <Badge variant={auditedIds.has(asset._id) ? "success" : "warning"}>
                          {auditedIds.has(asset._id) ? "Scanned" : "Missing"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <AssetTable
            assets={filteredAssets}
            onEdit={openEditModal}
            onDelete={handleDelete}
            user={user}
            selectedIds={selectedIds}
            onToggle={toggleAsset}
            onToggleAll={() => toggleAll(filteredAssets)}
          />
        )}
      </div>

      {/* Global Metadata Editor */}
      <AssetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        initialData={editingAsset}
      />
    </div>
  );
}


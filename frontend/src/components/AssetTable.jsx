import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge, Button, ConfirmModal, PermissionGuard } from "./UI";

/**
 * Enterprise Asset Inventory Table
 * Features: Role-based filtering, Action protection (Dual-Auth), Inline QR preview.
 */

export default function AssetTable({ assets, onEdit, onDelete, user, selectedIds = new Set(), onToggle, onToggleAll }) {
    const [selectedQr, setSelectedQr] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);

    if (!assets || assets.length === 0) {
        return (
            <div className="card text-center py-20 bg-slate-900 border-white/5">
                <p className="text-slate-500 font-medium">No assets found matching your criteria.</p>
            </div>
        );
    }

    const getStatusVariant = (status) => {
        switch (status) {
            case "available": return "success";
            case "assigned": return "info";
            case "maintenance": return "warning";
            case "pending_recovery": return "warning";
            case "retired": return "danger";
            default: return "neutral";
        }
    };

    const getRiskBadge = (asset) => {
        const score = asset.riskScore ?? 0;
        const level = asset.securityStatus?.riskLevel || 'Low';
        if (score <= 30) return { label: `Low (${score})`, style: 'bg-green-500/10 text-green-400 border-green-500/20' };
        if (score <= 60) return { label: `Medium (${score})`, style: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
        if (score <= 80) return { label: `High (${score})`, style: 'bg-red-500/10 text-red-400 border-red-500/20' };
        return { label: `Critical (${score})`, style: 'bg-red-700/20 text-red-300 border-red-700/30' };
    };

    const getWarrantyBadge = (value) => {
        if (!value) return { label: "Unknown", variant: "ghost" };
        const exp = new Date(value).getTime();
        const now = Date.now();
        const in30 = now + 30 * 24 * 60 * 60 * 1000;
        if (exp < now) return { label: "Expired", variant: "danger" };
        if (exp <= in30) return { label: "Expiring", variant: "warning" };
        return { label: "Active", variant: "success" };
    };

    const formatDate = (value) => {
        if (!value) return "—";
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
    };

    const getAge = (value) => {
        if (!value) return "—";
        const years = (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (!Number.isFinite(years)) return "—";
        return `${years.toFixed(1)} yrs`;
    };

    return (
        <div className="table-container fade-in">
            <table className="table">
                <thead>
                    <tr>
                        <th>
                            <input
                                type="checkbox"
                                className="accent-cyan-500"
                                checked={Array.isArray(assets) && assets.length > 0 && assets.every((a) => selectedIds.has(a._id))}
                                onChange={() => onToggleAll && onToggleAll()}
                            />
                        </th>
                        <th>Asset</th>
                        <th>Classification</th>
                        <th>Risk Score</th>
                        <th>Operational Status</th>
                        <th>Assigned To</th>
                        <th>IP / MAC</th>
                        <th>Location</th>
                        <th>Purchase / Age</th>
                        <th>Warranty</th>
                        <th className="text-center">QR Code</th>
                        <PermissionGuard roles={["Super Admin", "Admin", "Asset Manager"]} userRole={user?.role}>
                            <th className="text-right">Actions</th>
                        </PermissionGuard>
                    </tr>
                </thead>
                <tbody>
                    {Array.isArray(assets) && assets.map((asset, idx) => (
                        <tr key={asset._id || idx} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedAsset(asset)}>
                            <td>
                                <input
                                    type="checkbox"
                                    className="accent-cyan-500"
                                    checked={selectedIds.has(asset._id)}
                                    onChange={(e) => { e.stopPropagation(); onToggle && onToggle(asset._id); }}
                                />
                            </td>
                            <td>
                                <div className="font-bold text-slate-100">{asset.name}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-mono">
                                    UUID: {asset.uuid || "LEGACY-NODE"}
                                </div>
                                <div className="text-[11px] text-primary mt-1 font-mono font-bold">
                                    SN: {asset.serialNumber}
                                </div>
                            </td>
                            <td>
                                <Badge variant={
                                    asset.classification === "Restricted" ? "danger" :
                                        asset.classification === "Confidential" ? "warning" :
                                            asset.classification === "Internal" ? "info" : "neutral"
                                }>
                                    {asset.classification || "Internal"}
                                </Badge>
                            </td>
                            <td>
                                {(() => {
                                    const rb = getRiskBadge(asset); return (
                                        <span className={`px-2 py-1 rounded border text-[10px] font-bold whitespace-nowrap ${rb.style}`}>
                                            {rb.label}
                                        </span>
                                    );
                                })()}
                            </td>
                            <td>
                                <Badge variant={getStatusVariant(asset.status)}>
                                    {asset.status === 'retired' ? 'Archived' : asset.status === 'pending_recovery' ? 'Pending Recovery' : asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                                </Badge>
                            </td>
                            <td className="text-slate-400 font-medium">
                                {asset.assignedTo || "—"}
                            </td>
                            <td className="text-[10px] text-slate-400 font-mono">
                                <div>{asset.ipAddress || "—"}</div>
                                <div>{asset.macAddress || "—"}</div>
                            </td>
                            <td className="text-[10px] text-slate-400">
                                <div>{asset.location?.department || "—"}</div>
                                <div>{asset.location?.building || "—"}</div>
                            </td>
                            <td className="text-[10px] text-slate-400">
                                <div>{formatDate(asset.purchaseDate)}</div>
                                <div>{getAge(asset.purchaseDate)}</div>
                            </td>
                            <td className="text-[10px] text-slate-400">
                                <div className="flex items-center gap-2">
                                    <Badge variant={getWarrantyBadge(asset.warrantyExpiry).variant}>
                                        {getWarrantyBadge(asset.warrantyExpiry).label}
                                    </Badge>
                                    <span>{formatDate(asset.warrantyExpiry)}</span>
                                </div>
                            </td>
                            <td className="text-center">
                                {asset.qrCode ? (
                                    <img
                                        onClick={(e) => { e.stopPropagation(); setSelectedQr(asset); }}
                                        src={asset.qrCode}
                                        alt="Asset QR"
                                        className="w-10 h-10 inline-block cursor-pointer rounded bg-white p-1 opacity-80 hover:opacity-100 hover:scale-110 transition-all shadow-lg"
                                    />
                                ) : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="text-right">
                                <div className="flex justify-end gap-2">
                                    <PermissionGuard roles={["Super Admin", "Admin", "Asset Manager"]} userRole={user?.role}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); onEdit && onEdit(asset); }}
                                        >
                                            Edit
                                        </Button>
                                    </PermissionGuard>
                                    <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); setDeleteId(asset._id); }}
                                        >
                                            Delete
                                        </Button>
                                    </PermissionGuard>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Asset Detail Drawer */}
            <AnimatePresence>
                {selectedAsset && (
                    <motion.div
                        initial={{ x: 480, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 480, opacity: 0 }}
                        className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-950/95 border-l border-white/10 z-[120] p-6 overflow-y-auto"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-xs uppercase tracking-widest text-slate-500">Asset Detail</div>
                                <div className="text-lg font-bold text-white">{selectedAsset.name}</div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedAsset(null)}>Close</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                            <div>
                                <div className="text-slate-500">Status</div>
                                <div className="font-semibold">{selectedAsset.status || "—"}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Risk</div>
                                <div className="font-semibold">{selectedAsset.securityStatus?.riskLevel || "Low"}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Assigned To</div>
                                <div className="font-semibold">{selectedAsset.assignedTo || "—"}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Department</div>
                                <div className="font-semibold">{selectedAsset.location?.department || "—"}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">IP</div>
                                <div className="font-mono">{selectedAsset.ipAddress || "—"}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">MAC</div>
                                <div className="font-mono">{selectedAsset.macAddress || "—"}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Purchase Date</div>
                                <div className="font-semibold">{formatDate(selectedAsset.purchaseDate)}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Book Value</div>
                                <div className="font-semibold">₹{selectedAsset.bookValue ?? selectedAsset.purchasePrice ?? 0}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Warranty</div>
                                <div className="font-semibold">{formatDate(selectedAsset.warrantyExpiry)}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Last Check-in</div>
                                <div className="font-semibold">{selectedAsset.lastCheckIn ? new Date(selectedAsset.lastCheckIn).toLocaleString() : "—"}</div>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => { onEdit && onEdit(selectedAsset); setSelectedAsset(null); }}>
                                Edit Asset
                            </Button>
                            {selectedAsset.qrCode && (
                                <Button variant="ghost" size="sm" onClick={() => setSelectedQr(selectedAsset)}>
                                    View QR
                                </Button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* QR Modal Preview */}
            <AnimatePresence>
                {selectedQr && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
                        onClick={() => setSelectedQr(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="card w-full max-w-sm text-center bg-slate-900 border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-white font-bold text-lg mb-6">{selectedQr.name}</h3>
                            <div className="bg-white p-6 rounded-xl inline-block mb-6 shadow-2xl">
                                <img src={selectedQr.qrCode} alt="Large QR" className="w-56 h-56" />
                            </div>
                            <div className="mb-8">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Serial Authority</div>
                                <div className="font-mono text-slate-300 text-sm font-bold">{selectedQr.serialNumber}</div>
                            </div>
                            <Button variant="secondary" className="w-full" onClick={() => setSelectedQr(null)}>
                                Close
                            </Button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal (UX Requirement) */}
            <ConfirmModal
                isOpen={!!deleteId}
                title="Delete Asset?"
                message="Are you sure you want to delete this asset? This action cannot be undone."
                confirmText="Delete Asset"
                onConfirm={() => {
                    onDelete && onDelete(deleteId);
                    setDeleteId(null);
                }}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge, Button, ConfirmModal, PermissionGuard } from "./UI";

/**
 * Enterprise Asset Inventory Table
 * Features: Role-based filtering, Action protection (Dual-Auth), Inline QR preview.
 */

export default function AssetTable({ assets, onEdit, onDelete, user }) {
    const [selectedQr, setSelectedQr] = useState(null);
    const [deleteId, setDeleteId] = useState(null);

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
            case "retired": return "danger"; // Render as Archived visually later, but keep CSS variant mapped
            default: return "neutral";
        }
    };

    return (
        <div className="table-container fade-in">
            <table className="table">
                <thead>
                    <tr>
                        <th>Asset</th>
                        <th>Classification</th>
                        <th>Operational Status</th>
                        <th>Assigned To</th>
                        <th className="text-center">QR Code</th>
                        <PermissionGuard roles={["Super Admin", "Admin", "Asset Manager"]} userRole={user?.role}>
                            <th className="text-right">Actions</th>
                        </PermissionGuard>
                    </tr>
                </thead>
                <tbody>
                    {assets.map((asset, idx) => (
                        <tr key={asset._id || idx}>
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
                                <Badge variant={getStatusVariant(asset.status)}>
                                    {asset.status === 'retired' ? 'Archived' : asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                                </Badge>
                            </td>
                            <td className="text-slate-400 font-medium">
                                {asset.assignedTo || "—"}
                            </td>
                            <td className="text-center">
                                {asset.qrCode ? (
                                    <img
                                        onClick={() => setSelectedQr(asset)}
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
                                            onClick={() => onEdit && onEdit(asset)}
                                        >
                                            View Metadata
                                        </Button>
                                    </PermissionGuard>
                                    <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => setDeleteId(asset._id)}
                                        >
                                            Decommission Asset
                                        </Button>
                                    </PermissionGuard>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

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
                                Dismiss Archive
                            </Button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal (UX Requirement) */}
            <ConfirmModal
                isOpen={!!deleteId}
                title="Decommission Asset?"
                message="This will immediately move the asset out of service and revoke active telemetry tracking. Proceed with decommission?"
                confirmText="Decommission"
                onConfirm={() => {
                    onDelete && onDelete(deleteId);
                    setDeleteId(null);
                }}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}

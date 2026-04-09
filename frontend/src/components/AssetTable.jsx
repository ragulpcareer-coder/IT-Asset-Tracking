import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge, Button, ConfirmModal, PermissionGuard } from "./UI";

/**
 * Enterprise Asset Inventory Table
 * Features: Role-based filtering, Action protection (Dual-Auth), Inline QR preview.
 */

export default function AssetTable({ assets, onEdit, onDelete, user, loading = false }) {
    const [selectedQr, setSelectedQr] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const qrDialogRef = React.useRef(null);

    React.useEffect(() => {
        if (!selectedQr) return undefined;

        const previousActive = document.activeElement;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setSelectedQr(null);
                return;
            }

            if (event.key !== "Tab" || !qrDialogRef.current) return;
            const focusable = Array.from(
                qrDialogRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        const focusable = qrDialogRef.current?.querySelector('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        focusable?.focus();
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            previousActive?.focus?.();
        };
    }, [selectedQr]);

    if (loading && (!assets || assets.length === 0)) {
        return (
            <div className="table-container fade-in">
                <div className="p-6 space-y-4">
                    <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

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
            case "retired": return "danger";
            default: return "neutral";
        }
    };

    const getRiskBadge = (asset) => {
        const score = asset.riskScore ?? 0;
        if (score <= 30) return { label: `Low (${score})`, style: "bg-green-500/10 text-green-400 border-green-500/20" };
        if (score <= 60) return { label: `Medium (${score})`, style: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" };
        if (score <= 80) return { label: `High (${score})`, style: "bg-red-500/10 text-red-400 border-red-500/20" };
        return { label: `Critical (${score})`, style: "bg-red-700/20 text-red-300 border-red-700/30" };
    };

    return (
        <div className="table-container fade-in">
            <table className="table">
                <thead>
                    <tr>
                        <th>Asset</th>
                        <th>Classification</th>
                        <th>Risk Score</th>
                        <th>Operational Status</th>
                        <th>Assigned To</th>
                        <th className="text-center">QR Code</th>
                        <PermissionGuard roles={["Super Admin", "Admin", "Asset Manager"]} userRole={user?.role}>
                            <th className="text-right">Actions</th>
                        </PermissionGuard>
                    </tr>
                </thead>
                <tbody>
                    {Array.isArray(assets) && assets.map((asset) => (
                        <tr key={asset._id || `${asset.serialNumber}-${asset.name}`}>
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
                                    {asset.status === "retired" ? "Archived" : asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                                </Badge>
                            </td>
                            <td className="text-slate-400 font-medium">
                                {asset.assignedTo || "-"}
                            </td>
                            <td className="text-center">
                                {asset.qrCode ? (
                                    <img
                                        onClick={() => setSelectedQr(asset)}
                                        src={asset.qrCode}
                                        alt="Asset QR"
                                        className="w-10 h-10 inline-block cursor-pointer rounded bg-white p-1 opacity-80 hover:opacity-100 hover:scale-110 transition-all shadow-lg"
                                        loading="lazy"
                                        decoding="async"
                                        width={40}
                                        height={40}
                                    />
                                ) : <span className="text-slate-600">-</span>}
                            </td>
                            <td className="text-right">
                                <div className="flex justify-end gap-2">
                                    <PermissionGuard roles={["Super Admin", "Admin", "Asset Manager"]} userRole={user?.role}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEdit && onEdit(asset)}
                                        >
                                            Edit
                                        </Button>
                                    </PermissionGuard>
                                    <PermissionGuard roles={["Super Admin", "Admin"]} userRole={user?.role}>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => setDeleteId(asset._id)}
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

            <AnimatePresence>
                {selectedQr && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
                        onClick={() => setSelectedQr(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 14 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="card w-full max-w-sm text-center bg-slate-900 border-white/10"
                            role="dialog"
                            aria-modal="true"
                            aria-label={`QR code for ${selectedQr.name}`}
                            ref={qrDialogRef}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-white font-bold text-lg mb-6">{selectedQr.name}</h3>
                            <div className="bg-white p-6 rounded-xl inline-block mb-6 shadow-2xl">
                                <img
                                    src={selectedQr.qrCode}
                                    alt="Large QR"
                                    className="w-56 h-56"
                                    loading="lazy"
                                    decoding="async"
                                    width={224}
                                    height={224}
                                />
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



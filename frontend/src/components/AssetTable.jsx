import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AssetTable({ assets, onEdit, onDelete, user }) {
    const [selectedQr, setSelectedQr] = useState(null);

    if (!assets.length) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16 bg-[#0a0a0a] border border-white/10 rounded-xl"
            >
                <span className="text-gray-400 font-medium">No assets found matching your criteria.</span>
            </motion.div>
        );
    }

    const getStatusStyle = (status) => {
        switch (status) {
            case "available": return "bg-green-500/10 text-green-400 border-green-500/20";
            case "assigned": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "maintenance": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
            case "retired": return "bg-red-500/10 text-red-400 border-red-500/20";
            default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
        }
    };

    return (
        <>
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#000000]">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-white/10 text-gray-400 bg-[#050505]">
                            <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Asset</th>
                            <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Classification</th>
                            <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Type</th>
                            <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                            <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Assigned To</th>
                            <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-center">QR</th>
                            {["Super Admin", "Admin"].includes(user?.role) && <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        <AnimatePresence>
                            {assets.map((asset, idx) => (
                                <motion.tr
                                    key={asset._id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="border-b border-white/5 hover:bg-[#0a0a0a] transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="text-white font-medium">{asset.name}</div>
                                        <div className="text-[10px] text-gray-500 mt-1 font-mono uppercase tracking-tighter">UUID: {asset.uuid || "LEGACY-ID"}</div>
                                        <div className="text-xs text-blue-400 mt-1 font-mono">SN: {asset.serialNumber}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${asset.classification === "Restricted" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                asset.classification === "Confidential" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                                                    asset.classification === "Internal" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                        "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                            }`}>
                                            {asset.classification || "Internal"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full border ${getStatusStyle(asset.status)}`}
                                        >
                                            {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-sm">
                                        {asset.assignedTo || "—"}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {asset.qrCode ? (
                                            <img
                                                onClick={() => setSelectedQr(asset)}
                                                src={asset.qrCode}
                                                alt="QR Code"
                                                className="w-8 h-8 inline-block cursor-pointer rounded bg-white p-0.5 opacity-80 hover:opacity-100 transition-opacity"
                                            />
                                        ) : (
                                            <span className="text-xs text-gray-600">N/A</span>
                                        )}
                                    </td>
                                    {["Super Admin", "Admin"].includes(user?.role) && (
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 text-sm">
                                                <button
                                                    onClick={() => onEdit(asset)}
                                                    className="px-3 py-1.5 rounded bg-transparent text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => onDelete(asset._id)}
                                                    className="px-3 py-1.5 rounded bg-transparent text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {selectedQr && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedQr(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            className="bg-[#111] border border-white/10 p-8 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-medium text-white mb-6 text-center">{selectedQr.name}</h3>
                            <div className="bg-white p-4 rounded-xl flex justify-center mb-6">
                                <img src={selectedQr.qrCode} alt="Large QR" className="w-48 h-48" />
                            </div>
                            <div className="text-center mb-8">
                                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Serial Number</p>
                                <p className="font-mono text-gray-300">{selectedQr.serialNumber}</p>
                            </div>
                            <button
                                onClick={() => setSelectedQr(null)}
                                className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors font-medium text-sm"
                            >
                                Close
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

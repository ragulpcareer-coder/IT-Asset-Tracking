import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AssetModal({ isOpen, onClose, onSubmit, initialData }) {
    const [formData, setFormData] = useState({
        name: "",
        type: "",
        serialNumber: "",
        status: "available",
        assignedTo: "",
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({
                name: "",
                type: "",
                serialNumber: "",
                status: "available",
                assignedTo: "",
            });
        }
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-8">
                            <h2 className="text-xl font-medium text-white mb-6">
                                {initialData ? "Edit Asset" : "New Asset"}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Name</label>
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-white/30 transition-all placeholder-gray-600"
                                        required
                                        placeholder="MacBook Pro"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Type</label>
                                    <input
                                        name="type"
                                        value={formData.type}
                                        onChange={handleChange}
                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-white/30 transition-all placeholder-gray-600"
                                        required
                                        placeholder="Laptop, Display..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Serial Number</label>
                                    <input
                                        name="serialNumber"
                                        value={formData.serialNumber}
                                        onChange={handleChange}
                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white text-sm font-mono outline-none focus:border-white/30 transition-all placeholder-gray-600"
                                        required
                                        placeholder="SN-XXXX"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Status</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="available">Available</option>
                                        <option value="assigned">Assigned</option>
                                        <option value="maintenance">Maintenance</option>
                                        <option value="retired">Retired</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400">Assigned To (Optional)</label>
                                    <input
                                        name="assignedTo"
                                        value={formData.assignedTo}
                                        onChange={handleChange}
                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-white/30 transition-all placeholder-gray-600"
                                        placeholder="user@enterprise.com"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-6">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-5 py-2.5 rounded-lg bg-transparent text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2.5 rounded-lg bg-white text-black hover:bg-gray-100 transition-colors text-sm font-medium"
                                    >
                                        {initialData ? "Save Changes" : "Create Asset"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

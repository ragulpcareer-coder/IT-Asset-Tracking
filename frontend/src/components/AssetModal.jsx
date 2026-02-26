import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input } from "./UI";

/**
 * Enterprise Asset Metadata Editor
 * Features: Form validation, Loading-state protection, Dynamic status transition rules (§6.4).
 */

export default function AssetModal({ isOpen, onClose, onSubmit, initialData }) {
    const [formData, setFormData] = useState({
        name: "",
        type: "",
        serialNumber: "",
        status: "available",
        classification: "Internal",
        assignedTo: "",
        purchasePrice: 0,
        usefulLifeYears: 5
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...formData,
                ...initialData,
                assignedTo: initialData.assignedTo || ""
            });
        } else {
            setFormData({
                name: "",
                type: "",
                serialNumber: "",
                status: "available",
                classification: "Internal",
                assignedTo: "",
                purchasePrice: 0,
                usefulLifeYears: 5
            });
        }
        setErrors({});
    }, [initialData, isOpen]);

    const validate = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = "Asset name is required";
        if (!formData.type.trim()) newErrors.type = "Asset category is required";
        if (!formData.serialNumber.trim()) newErrors.serialNumber = "Serial number is required";
        if (formData.status === "assigned" && !formData.assignedTo.trim()) {
            newErrors.assignedTo = "Assigned assets require a target identity/email";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error as user types
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            await onSubmit(formData);
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 15 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 15 }}
                        className="card w-full max-w-2xl bg-slate-950 border-white/10 my-10"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
                            <div>
                                <h2 className="text-xl font-extrabold text-white tracking-tight">
                                    {initialData ? "Metadata Overhaul" : "Register New Node"}
                                </h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1 italic">
                                    Enterprise Inventory Authority (Section 6.4)
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <Input
                                    label="Node Name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="MacBook Pro / AWS Edge Server"
                                    error={errors.name}
                                    required
                                />
                                <Input
                                    label="Category / Cluster"
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    placeholder="Laptop, Host, Gateway..."
                                    error={errors.type}
                                    required
                                />
                                <Input
                                    label="Registry Serial (SN)"
                                    name="serialNumber"
                                    value={formData.serialNumber}
                                    onChange={handleChange}
                                    placeholder="SN-XXXXX-XXXXX"
                                    error={errors.serialNumber}
                                    required
                                    disabled={!!initialData} // Lock serial on edit
                                />
                                <div className="form-group">
                                    <label className="label">Operational Status</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="input appearance-none bg-slate-900 border-white/10"
                                    >
                                        <option value="available">Available / Inventory</option>
                                        <option value="assigned">Assigned / Locked</option>
                                        <option value="maintenance">Maintenance / Offline</option>
                                        <option value="retired">Retired / Decommissioned</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Encryption Classification</label>
                                    <select
                                        name="classification"
                                        value={formData.classification}
                                        onChange={handleChange}
                                        className="input appearance-none bg-slate-900 border-white/10"
                                    >
                                        <option value="Public">Level 0: Public</option>
                                        <option value="Internal">Level 1: Internal</option>
                                        <option value="Confidential">Level 2: Confidential</option>
                                        <option value="Restricted">Level 3: Restricted</option>
                                    </select>
                                </div>
                                <Input
                                    label="Assigned Target (Email)"
                                    name="assignedTo"
                                    value={formData.assignedTo}
                                    onChange={handleChange}
                                    placeholder="user@enterprise.com"
                                    error={errors.assignedTo}
                                />
                                <Input
                                    label="Acquisition Cost ($)"
                                    name="purchasePrice"
                                    type="number"
                                    value={formData.purchasePrice}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                />
                                <Input
                                    label="Useful Service Life (Years)"
                                    name="usefulLifeYears"
                                    type="number"
                                    value={formData.usefulLifeYears}
                                    onChange={handleChange}
                                    placeholder="5"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                                <Button variant="secondary" onClick={onClose} disabled={loading}>
                                    Abort Operation
                                </Button>
                                <Button type="submit" variant="primary" loading={loading}>
                                    {initialData ? "Apply Protocol" : "Initialize Node"}
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

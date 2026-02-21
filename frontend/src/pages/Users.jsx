import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { Button, Card, Badge } from "../components/UI";
import { ProfessionalIcon } from "../components/ProfessionalIcons";
import { animationVariants } from "../utils/animations";

export default function Users() {
    const { user } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get("/auth/users");
            setUsers(res.data);
        } catch (err) {
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handlePromote = async (id, name) => {
        if (!window.confirm(`Are you sure you want to promote ${name} to Admin?`)) return;
        try {
            await axios.put(`/auth/users/${id}/promote`);
            toast.success(`${name} has been promoted to Admin`);
            fetchUsers();
        } catch (err) {
            toast.error("Failed to promote user");
        }
    };

    const handleDelete = async (id, email) => {
        if (email === user.email) {
            toast.error("You cannot delete your own account");
            return;
        }
        if (!window.confirm(`Are you sure you want to completely remove ${email}? This action acts as an instant ban & wipes all sessions.`)) return;
        try {
            await axios.delete(`/auth/users/${id}`);
            toast.success(`User ${email} has been terminated.`);
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to delete user");
        }
    };

    return (
        <div className="pb-10 text-white">
            <motion.div className="mb-8 px-2 pt-8" initial="hidden" animate="visible" variants={animationVariants.containerVariants}>
                <motion.h1 variants={animationVariants.itemVariants} className="text-3xl font-semibold tracking-tight mb-1 flex items-center gap-3">
                    <ProfessionalIcon name="shield" size={28} /> Zero-Trust User Management
                </motion.h1>
                <motion.p variants={animationVariants.itemVariants} className="text-gray-400 text-sm font-medium mt-1">
                    Monitor exactly who currently holds access logically inside the environment.
                </motion.p>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={animationVariants.containerVariants}>
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-500 text-sm">
                                    <th className="py-4 px-4 font-medium">User Profile</th>
                                    <th className="py-4 px-4 font-medium">Clearance Level</th>
                                    <th className="py-4 px-4 font-medium">Failed Logins</th>
                                    <th className="py-4 px-4 font-medium">2FA Status</th>
                                    <th className="py-4 px-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-gray-500">Scanning network users...</td>
                                        </tr>
                                    ) : users.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-gray-500">No users found.</td>
                                        </tr>
                                    ) : (
                                        users.map((u) => (
                                            <motion.tr
                                                key={u._id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="border-b border-white/5 hover:bg-white/5 transition"
                                            >
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-[#111] border border-white/10 flex items-center justify-center font-bold text-gray-300">
                                                            {u.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-white text-sm">{u.name} {u.email === user.email && "(You)"}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <Badge variant={u.role === "Admin" ? "success" : "neutral"} size="sm">
                                                        {u.role.toUpperCase()}
                                                    </Badge>
                                                </td>
                                                <td className="py-4 px-4">
                                                    {u.lockUntil && new Date(u.lockUntil) > new Date() ? (
                                                        <span className="text-red-400 text-xs font-bold uppercase tracking-wider bg-red-500/10 px-2 py-1 rounded">LOCKED OUT</span>
                                                    ) : u.failedLoginAttempts > 0 ? (
                                                        <span className="text-orange-400 text-xs font-bold">{u.failedLoginAttempts} ATTEMPTS</span>
                                                    ) : (
                                                        <span className="text-gray-600 text-xs font-bold">CLEAR</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4">
                                                    {u.isTwoFactorEnabled ? (
                                                        <span className="text-green-400 text-xs font-bold bg-green-500/10 px-2 py-1 rounded">SECURED</span>
                                                    ) : (
                                                        <span className="text-gray-500 text-xs">Unsecured</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {u.role !== "Admin" && (
                                                            <Button variant="secondary" size="sm" onClick={() => handlePromote(u._id, u.name)}>
                                                                Promote
                                                            </Button>
                                                        )}
                                                        {u.email !== user.email && (
                                                            <Button variant="danger" size="sm" onClick={() => handleDelete(u._id, u.email)}>
                                                                Terminate
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))
                                    )}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
}

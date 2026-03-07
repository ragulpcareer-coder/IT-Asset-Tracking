import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { Button, Card, Badge, ConfirmModal } from "../components/UI";
import LoadingSpinner from "../components/common/LoadingSpinner";

/**
 * Enterprise Identity & Access Management (IAM)
 * Features: Zero-Trust user oversight, Account state monitoring, Privilege escalation management.
 */

export default function Users() {
    const { user: currentUser } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionUser, setActionUser] = useState(null); // { id, email, actionType }

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get("/auth/users");
            // API unmasking: The backend returns a paginated object { users, total, pages, currentPage }
            // We ensure we extract the users array and provide a fallback.
            setUsers(res.data.users || res.data || []);
        } catch (err) {
            toast.error("Failed to sync IAM registry");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleConfirmAction = async () => {
        if (!actionUser) return;
        const { id, actionType, email, name } = actionUser;

        try {
            if (actionType === "promote") {
                await axios.put(`/auth/users/${id}/promote`);
                toast.success(`${name} has been promoted to Admin.`);
            } else if (actionType === "terminate") {
                await axios.delete(`/auth/users/${id}`);
                toast.success(`User ${email} has been removed.`);
            } else if (actionType === "approve") {
                await axios.put(`/auth/users/${id}/approve`);
                toast.success(`Account for ${email} has been white-listed and approved.`);
            }
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.message || "Action failed. Please try again.");
        } finally {
            setActionUser(null);
        }
    };

    if (!currentUser || !["Super Admin", "Admin"].includes(currentUser.role)) {
        return (
            <div className="flex-center min-h-[60vh] flex-col text-center card bg-slate-900/50 border-red-500/20">
                <div className="text-5xl mb-6">🔒</div>
                <h2 className="text-2xl font-black text-white px-2">Access Denied: IAM Restricted</h2>
                <p className="text-slate-500 max-w-md mt-4 px-4 text-sm font-medium">
                    The Identity & Access Management console is restricted to Level 2 Administrators.
                    Attempts to bypass this gateway are logged as Critical Violations.
                </p>
            </div>
        );
    }

    return (
        <div className="fade-in pb-12">
            <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-white tracking-tighter uppercase">Identity & Access Management</h1>
                <p className="text-slate-500 font-medium mt-1 text-xs tracking-widest uppercase italic">
                    Manage user accounts, roles, and access permissions
                </p>
            </div>

            <Card className="p-0 overflow-hidden border-white/5 bg-slate-900/40">
                <div className="table-container border-none rounded-none">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Account Status</th>
                                <th>MFA Status</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center"><LoadingSpinner message="Scanning IAM Database..." /></td>
                                    </tr>
                                ) : (Array.isArray(users) && users.length === 0) ? (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center text-slate-500 font-bold italic uppercase tracking-widest text-sm">No active identities found.</td>
                                    </tr>
                                ) : (Array.isArray(users) && users.length > 0) ? (
                                    Array.isArray(users) && users.map((u) => (
                                        <motion.tr
                                            key={u._id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="hover:bg-white/5 transition-colors"
                                        >
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 group-hover:border-cyan-500/50 transition-colors">
                                                        <span className="text-xs font-black text-cyan-500">{(u.name?.[0] || u.email?.[0] || "?").toUpperCase()}</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-bold text-xs">{u.name || (u.email ? u.email.split("@")[0] : "Unknown Identity")}</div>
                                                        <div className="text-[10px] text-slate-500">{u.email || "No Email Recorded"}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <Badge variant={u.role === "ADMIN" ? "danger" : "info"}>
                                                    {u.role || "EMPLOYEE"}
                                                </Badge>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"}`} />
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">{u.isActive ? "Active" : "Suspended"}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold ${u.twoFactorEnabled ? "text-cyan-500" : "text-slate-600"}`}>
                                                        {u.twoFactorEnabled ? "VERIFIED" : "UNSET"}
                                                    </span>
                                                    {u.twoFactorEnabled && <span className="text-[10px]">🛡️</span>}
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {!["Super Admin", "Admin"].includes(u.role) && (
                                                        <Button variant="ghost" size="sm" onClick={() => setActionUser({ ...u, actionType: 'promote' })}>
                                                            Promote to Admin
                                                        </Button>
                                                    )}
                                                    {!u.isApproved && (
                                                        <Button variant="success" size="sm" onClick={() => setActionUser({ ...u, actionType: 'approve' })}>
                                                            Approve Account
                                                        </Button>
                                                    )}
                                                    {u.email !== currentUser.email && (
                                                        <Button variant="danger" size="sm" onClick={() => setActionUser({ ...u, actionType: 'terminate' })}>
                                                            Remove User
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                ) : null}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* IAM Action Confirmation */}
            <ConfirmModal
                isOpen={!!actionUser}
                title={actionUser?.actionType === 'promote' ? "Promote to Admin?" : actionUser?.actionType === 'approve' ? "Approve User?" : "Remove User?"}
                message={actionUser?.actionType === 'promote'
                    ? `Are you sure you want to promote ${actionUser?.name} to Administrator? They will gain access to the Audit Logs and Identity Management pages.`
                    : actionUser?.actionType === 'approve'
                        ? `Are you sure you want to approve the account for ${actionUser?.email}? They will be able to log in to the system immediately.`
                        : `Are you sure you want to remove ${actionUser?.email}? Their account will be deleted and all active sessions will be terminated.`
                }
                confirmText={actionUser?.actionType === 'promote' ? "Confirm Promotion" : actionUser?.actionType === 'approve' ? "Approve Account" : "Confirm Removal"}
                type={actionUser?.actionType === 'promote' ? "primary" : actionUser?.actionType === 'approve' ? "success" : "danger"}
                onConfirm={handleConfirmAction}
                onCancel={() => setActionUser(null)}
            />
        </div>
    );
}

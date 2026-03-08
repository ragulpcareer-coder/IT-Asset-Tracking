import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { Button, Card, Badge, ConfirmModal } from "../components/UI";
import LoadingSpinner from "../components/common/LoadingSpinner";

export default function Users() {
    const { user: currentUser } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionUser, setActionUser] = useState(null);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get("/auth/users");
            const list = Array.isArray(res.data?.users) ? res.data.users : Array.isArray(res.data) ? res.data : [];
            setUsers(list);
        } catch (err) {
            toast.error("Failed to load users.");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const getUserId = (u) => u?._id || u?.id;
    const currentUserId = getUserId(currentUser);

    const handleConfirmAction = async () => {
        if (!actionUser) return;

        const targetId = getUserId(actionUser);
        if (actionUser.actionType === "terminate" && currentUserId && targetId === currentUserId) {
            toast.error("You cannot remove your own account.");
            setActionUser(null);
            return;
        }
        if (!targetId) {
            toast.error("Invalid user identifier.");
            setActionUser(null);
            return;
        }

        try {
            let response;

            if (actionUser.actionType === "promote") {
                response = await axios.put(`/auth/users/${targetId}/promote`);
                if (response.status === 202 || response.data?.pendingActionId) {
                    toast.info(response.data?.message || "Promotion request submitted for secondary approval.");
                } else {
                    toast.success(`${actionUser.name || actionUser.email} has been promoted.`);
                }
            } else if (actionUser.actionType === "terminate") {
                response = await axios.delete(`/auth/users/${targetId}`);
                if (response.status === 202 || response.data?.pendingActionId) {
                    toast.info(response.data?.message || "Deletion request submitted for secondary approval.");
                } else {
                    toast.success(`User ${actionUser.email} has been removed.`);
                }
            } else if (actionUser.actionType === "approve") {
                response = await axios.put(`/auth/users/${targetId}/approve`);
                toast.success(response.data?.message || `Account for ${actionUser.email} has been approved.`);
            }

            await fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.message || "Action failed. Please try again.");
        } finally {
            setActionUser(null);
        }
    };

    if (!currentUser || !["Super Admin", "Admin"].includes(currentUser.role)) {
        return (
            <div className="flex-center min-h-[60vh] flex-col text-center card bg-slate-900/50 border-red-500/20">
                <h2 className="text-2xl font-black text-white px-2">Access Denied</h2>
                <p className="text-slate-500 max-w-md mt-4 px-4 text-sm font-medium">
                    Identity and Access Management is available only for Admin and Super Admin accounts.
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
                                        <td colSpan="5" className="py-20 text-center"><LoadingSpinner message="Loading users..." /></td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center text-slate-500 font-bold italic uppercase tracking-widest text-sm">No users found.</td>
                                    </tr>
                                ) : users.map((u) => (
                                    <motion.tr
                                        key={getUserId(u)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="hover:bg-white/5 transition-colors"
                                    >
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                                                    <span className="text-xs font-black text-cyan-500">{(u.name?.[0] || u.email?.[0] || "?").toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <div className="text-white font-bold text-xs">{u.name || u.email?.split("@")[0] || "Unknown"}</div>
                                                    <div className="text-[10px] text-slate-500">{u.email || "No email"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant={u.role === "Super Admin" || u.role === "Admin" ? "danger" : "info"}>
                                                {u.role || "Employee"}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"}`} />
                                                <span className="text-[10px] font-black text-slate-300 uppercase">{u.isActive ? "Active" : "Suspended"}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`text-[10px] font-bold ${u.twoFactorEnabled ? "text-cyan-500" : "text-slate-600"}`}>
                                                {u.twoFactorEnabled ? "VERIFIED" : "UNSET"}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {!u.isApproved && (
                                                    <Button variant="success" size="sm" onClick={() => setActionUser({ ...u, actionType: "approve" })}>
                                                        Approve Account
                                                    </Button>
                                                )}
                                                {!["Super Admin", "Admin"].includes(u.role) && (
                                                    <Button variant="ghost" size="sm" onClick={() => setActionUser({ ...u, actionType: "promote" })}>
                                                        Promote to Admin
                                                    </Button>
                                                )}
                                                {getUserId(u) !== currentUserId && (
                                                    <Button variant="danger" size="sm" onClick={() => setActionUser({ ...u, actionType: "terminate" })}>
                                                        Remove User
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </Card>

            <ConfirmModal
                isOpen={!!actionUser}
                title={
                    actionUser?.actionType === "promote"
                        ? "Promote to Admin?"
                        : actionUser?.actionType === "approve"
                            ? "Approve User?"
                            : "Remove User?"
                }
                message={
                    actionUser?.actionType === "promote"
                        ? `Are you sure you want to promote ${actionUser?.name || actionUser?.email} to Administrator?`
                        : actionUser?.actionType === "approve"
                            ? `Are you sure you want to approve ${actionUser?.email}?`
                            : `Are you sure you want to remove ${actionUser?.email}?`
                }
                confirmText={
                    actionUser?.actionType === "promote"
                        ? "Confirm Promotion"
                        : actionUser?.actionType === "approve"
                            ? "Approve Account"
                            : "Confirm Removal"
                }
                type={actionUser?.actionType === "terminate" ? "danger" : "primary"}
                onConfirm={handleConfirmAction}
                onCancel={() => setActionUser(null)}
            />
        </div>
    );
}



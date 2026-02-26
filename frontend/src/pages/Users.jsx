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
            setUsers(res.data);
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
                toast.success(`${name} elevated to Administrative Clearance.`);
            } else if (actionType === "terminate") {
                await axios.delete(`/auth/users/${id}`);
                toast.success(`Identity ${email} has been decommissioned.`);
            }
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.message || "Protocol rejection: Action denied.");
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
                <h1 className="text-3xl font-extrabold text-white tracking-tighter uppercase">Identity Registry</h1>
                <p className="text-slate-500 font-medium mt-1 text-xs tracking-widest uppercase italic">
                    Zero-Trust Oversight & Privilege Management (§3.1)
                </p>
            </div>

            <Card className="p-0 overflow-hidden border-white/5 bg-slate-900/40">
                <div className="table-container border-none rounded-none">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Identity Identity</th>
                                <th>Clearance</th>
                                <th>Account Status</th>
                                <th>2FA Core</th>
                                <th className="text-right">IAM Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center"><LoadingSpinner message="Scanning IAM Database..." /></td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center text-slate-500 font-bold italic uppercase tracking-widest text-sm">No active identities found.</td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <motion.tr
                                            key={u._id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="hover:bg-white/5 transition-all"
                                        >
                                            <td>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 border border-white/10 flex items-center justify-center font-bold text-white shadow-lg">
                                                        {u.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-100 text-sm">
                                                            {u.name} {u.email === currentUser.email && <Badge variant="info" className="ml-2 py-0">SELF</Badge>}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <Badge variant={["Super Admin", "Admin"].includes(u.role) ? "info" : "neutral"} className="font-bold px-2 py-0.5">
                                                    {u.role.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td>
                                                {u.lockUntil && new Date(u.lockUntil) > new Date() ? (
                                                    <Badge variant="danger" className="animate-pulse">ACCOUNT LOCKED</Badge>
                                                ) : u.failedLoginAttempts > 0 ? (
                                                    <div className="text-amber-500 text-[10px] font-black uppercase tracking-widest">{u.failedLoginAttempts} Failed Attempts</div>
                                                ) : (
                                                    <div className="text-green-500 text-[10px] font-black uppercase tracking-widest">Nominal / Secure</div>
                                                )}
                                            </td>
                                            <td>
                                                {u.isTwoFactorEnabled ? (
                                                    <Badge variant="success" className="font-bold">2FA ENABLED</Badge>
                                                ) : (
                                                    <Badge variant="neutral" className="opacity-40">NOT CONFIGURED</Badge>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {!["Super Admin", "Admin"].includes(u.role) && (
                                                        <Button variant="ghost" size="sm" onClick={() => setActionUser({ ...u, actionType: 'promote' })}>
                                                            Elevate Role
                                                        </Button>
                                                    )}
                                                    {u.email !== currentUser.email && (
                                                        <Button variant="danger" size="sm" onClick={() => setActionUser({ ...u, actionType: 'terminate' })}>
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

            {/* IAM Action Confirmation */}
            <ConfirmModal
                isOpen={!!actionUser}
                title={actionUser?.actionType === 'promote' ? "Elevate Clearance?" : "Terminate Identity?"}
                message={actionUser?.actionType === 'promote'
                    ? `Are you sure you want to promote ${actionUser?.name} to Administrative Clearance? This grants access to the Forensic Ledger and IAM controls.`
                    : `This initiates an immediate Decommission Protocol for ${actionUser?.email}. All active sessions will be purged and authentication tokens revoked.`
                }
                confirmText={actionUser?.actionType === 'promote' ? "Execute Elevation" : "Execute Termination"}
                type={actionUser?.actionType === 'promote' ? "primary" : "danger"}
                onConfirm={handleConfirmAction}
                onCancel={() => setActionUser(null)}
            />
        </div>
    );
}

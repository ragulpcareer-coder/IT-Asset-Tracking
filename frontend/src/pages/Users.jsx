import React, { useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { Button, Card, Badge, ConfirmModal } from "../components/UI";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { socket } from "../services/socket";

export default function Users() {
    const { user: currentUser } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionUser, setActionUser] = useState(null);
    const [onboardName, setOnboardName] = useState("");
    const [onboardEmail, setOnboardEmail] = useState("");
    const [onboardingLoading, setOnboardingLoading] = useState(false);
    const [offboardReason, setOffboardReason] = useState("");
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditUserEmail, setAuditUserEmail] = useState("");
    const [pendingActions, setPendingActions] = useState([]);
    const [pendingStatus, setPendingStatus] = useState("PENDING");
    const [pendingLoading, setPendingLoading] = useState(false);

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
        socket.connect();
        const onUserDeleted = (payload) => {
            const removedId = payload?.userId;
            if (!removedId) return;
            setUsers((prev) => prev.filter((u) => String(getUserId(u)) !== String(removedId)));
        };
        const onUserOffboarded = (payload) => {
            const offId = payload?.userId;
            if (!offId) return;
            setUsers((prev) => prev.map((u) => String(getUserId(u)) === String(offId) ? { ...u, isActive: false, offboardedAt: new Date().toISOString() } : u));
        };
        socket.on("userDeleted", onUserDeleted);
        socket.on("userOffboarded", onUserOffboarded);

        return () => {
            socket.off("userDeleted", onUserDeleted);
            socket.off("userOffboarded", onUserOffboarded);
        };
    }, []);

    useEffect(() => {
        const loadAudit = async () => {
            try {
                setAuditLoading(true);
                const res = await axios.get("/audit?limit=200");
                const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
                setAuditLogs(list);
            } catch (err) {
                setAuditLogs([]);
            } finally {
                setAuditLoading(false);
            }
        };
        if (["Super Admin", "Admin"].includes(currentUser?.role)) {
            loadAudit();
        }
    }, [currentUser?.role]);

    const loadPending = async () => {
        try {
            setPendingLoading(true);
            const res = await axios.get(`/pending?status=${pendingStatus}`);
            const list = Array.isArray(res.data?.actions) ? res.data.actions : [];
            setPendingActions(list);
        } catch (err) {
            setPendingActions([]);
        } finally {
            setPendingLoading(false);
        }
    };

    useEffect(() => {
        if (["Super Admin", "Admin"].includes(currentUser?.role)) {
            loadPending();
        }
    }, [currentUser?.role, pendingStatus]);

    const executePendingAction = async (action) => {
        try {
            if (action.actionType === "DELETE_ASSET") {
                await axios.delete(`/assets/${action.data?.assetId}?approvalId=${action._id}`);
                toast.success("Asset deletion executed.");
            } else if (action.actionType === "MASS_USER_DELETE") {
                await axios.delete(`/auth/users/${action.data?.targetUserId}?approvalId=${action._id}`);
                toast.success("User deletion executed.");
            } else if (action.actionType === "PROMOTE_USER") {
                await axios.put(`/auth/users/${action.data?.targetUserId}/promote?approvalId=${action._id}`);
                toast.success("User promotion executed.");
            } else {
                toast.info("No executor available for this action type.");
            }
            setPendingStatus("PENDING");
        } catch (err) {
            toast.error(err.response?.data?.message || "Execution failed.");
        } finally {
            loadPending();
        }
    };

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
                    setUsers((prev) => prev.filter((u) => String(getUserId(u)) !== String(targetId)));
                    toast.success(`User ${actionUser.email} has been removed.`);
                }
            } else if (actionUser.actionType === "offboard") {
                response = await axios.put(`/auth/users/${targetId}/offboard`, {
                    reason: offboardReason.trim() || "Administrative offboard"
                });
                toast.success(response.data?.message || `User ${actionUser.email} offboarded.`);
            } else if (actionUser.actionType === "approve") {
                response = await axios.put(`/auth/users/${targetId}/approve`);
                toast.success(response.data?.message || `Account for ${actionUser.email} has been approved.`);
            }

            if (!(response?.status === 202 || response?.data?.pendingActionId)) {
                await fetchUsers();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Action failed. Please try again.");
        } finally {
            setActionUser(null);
            setOffboardReason("");
        }
    };

    const handleOnboarding = async () => {
        if (!onboardEmail.trim()) {
            toast.error("Email is required for onboarding.");
            return;
        }
        try {
            setOnboardingLoading(true);
            const res = await axios.post("/onboarding/auto-assign", {
                name: onboardName.trim(),
                email: onboardEmail.trim()
            });
            toast.success(res.data?.message || "Onboarding complete.");
            setOnboardName("");
            setOnboardEmail("");
        } catch (err) {
            toast.error(err.response?.data?.message || "Onboarding failed.");
        } finally {
            setOnboardingLoading(false);
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

            <Card className="mb-8 p-6 bg-slate-900/40 border-white/5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Zero‑Touch Onboarding Simulator</h2>
                        <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest">
                            Auto‑assign the oldest available laptop and send a welcome email.
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <input
                        className="input bg-slate-950/40 border-white/5"
                        placeholder="New hire name"
                        value={onboardName}
                        onChange={(e) => setOnboardName(e.target.value)}
                    />
                    <input
                        className="input bg-slate-950/40 border-white/5"
                        placeholder="New hire email"
                        value={onboardEmail}
                        onChange={(e) => setOnboardEmail(e.target.value)}
                    />
                    <Button variant="primary" onClick={handleOnboarding} disabled={onboardingLoading}>
                        {onboardingLoading ? "Assigning..." : "Auto‑Assign Laptop"}
                    </Button>
                </div>
            </Card>

            <Card className="p-0 overflow-hidden border-white/5 bg-slate-900/40">
                <div className="table-container border-none rounded-none">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Account Status</th>
                                <th>MFA Status</th>
                                <th>Last Login</th>
                                <th>Offboarded</th>
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
                                                <span className="text-[10px] font-black text-slate-300 uppercase">{u.isActive ? "Active" : (u.offboardedAt ? "Offboarded" : "Suspended")}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`text-[10px] font-bold ${u.twoFactorEnabled ? "text-cyan-500" : "text-slate-600"}`}>
                                                {u.twoFactorEnabled ? "VERIFIED" : "UNSET"}
                                            </span>
                                        </td>
                                        <td className="text-[10px] text-slate-400">
                                            {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "—"}
                                        </td>
                                        <td className="text-[10px] text-slate-400">
                                            {u.offboardedAt ? new Date(u.offboardedAt).toLocaleString() : "—"}
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
                                                {u.isActive && getUserId(u) !== currentUserId && (
                                                    <Button variant="secondary" size="sm" onClick={() => setActionUser({ ...u, actionType: "offboard" })}>
                                                        Offboard
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
                            : actionUser?.actionType === "offboard"
                                ? "Offboard User?"
                            : "Remove User?"
                }
                message={
                    actionUser?.actionType === "promote"
                        ? `Are you sure you want to promote ${actionUser?.name || actionUser?.email} to Administrator?`
                        : actionUser?.actionType === "approve"
                            ? `Are you sure you want to approve ${actionUser?.email}?`
                            : actionUser?.actionType === "offboard"
                                ? `Offboard ${actionUser?.email} and mark their assets for recovery?`
                            : `Are you sure you want to remove ${actionUser?.email}?`
                }
                confirmText={
                    actionUser?.actionType === "promote"
                        ? "Confirm Promotion"
                        : actionUser?.actionType === "approve"
                            ? "Approve Account"
                            : actionUser?.actionType === "offboard"
                                ? "Confirm Offboard"
                            : "Confirm Removal"
                }
                type={actionUser?.actionType === "terminate" ? "danger" : "primary"}
                onConfirm={handleConfirmAction}
                onCancel={() => setActionUser(null)}
            >
                {actionUser?.actionType === "offboard" && (
                    <div className="space-y-2">
                        <label className="text-[11px] uppercase tracking-widest text-slate-500">Offboard Reason</label>
                        <input
                            className="input bg-slate-950/40 border-white/10"
                            placeholder="Reason for offboarding"
                            value={offboardReason}
                            onChange={(e) => setOffboardReason(e.target.value)}
                        />
                    </div>
                )}
            </ConfirmModal>

            <Card className="mt-10 p-6 bg-slate-900/40 border-white/5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Pending 4‑Eyes Actions</h2>
                        <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest">Approve, reject, or execute approved actions</p>
                    </div>
                    <select
                        className="input bg-slate-950/40 border-white/10 w-full md:w-60"
                        value={pendingStatus}
                        onChange={(e) => setPendingStatus(e.target.value)}
                    >
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
                </div>
                <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
                    {pendingLoading && <div className="text-slate-500 text-sm">Loading pending actions...</div>}
                    {!pendingLoading && pendingActions.length === 0 && (
                        <div className="text-slate-500 text-sm">No actions in this state.</div>
                    )}
                    {!pendingLoading && pendingActions.map((action) => (
                        <div key={action._id} className="rounded border border-white/5 bg-slate-950/40 p-3 text-xs">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-white font-semibold">{action.actionType}</div>
                                    <div className="text-slate-500">Requested by: {action.createdBy?.email || action.createdBy}</div>
                                </div>
                                <Badge variant={action.status === "APPROVED" ? "success" : action.status === "REJECTED" ? "danger" : "warning"}>
                                    {action.status}
                                </Badge>
                            </div>
                            <div className="text-slate-500 mt-2">
                                Target: {action.data?.assetName || action.data?.targetEmail || action.data?.assetId || action.data?.targetUserId || "N/A"}
                            </div>
                            <div className="text-slate-600 mt-1">Requested: {new Date(action.createdAt).toLocaleString()}</div>
                            <div className="flex gap-2 mt-3">
                                {action.status === "PENDING" && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="success"
                                            onClick={() => axios.put(`/pending/${action._id}/approve`)
                                                .then(() => { toast.success("Approved."); setPendingStatus("PENDING"); loadPending(); })
                                                .catch((err) => toast.error(err.response?.data?.message || "Approval failed."))}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => axios.put(`/pending/${action._id}/reject`)
                                                .then(() => { toast.info("Rejected."); setPendingStatus("PENDING"); loadPending(); })
                                                .catch((err) => toast.error(err.response?.data?.message || "Rejection failed."))}
                                        >
                                            Reject
                                        </Button>
                                    </>
                                )}
                                {action.status === "APPROVED" && (
                                    <Button size="sm" variant="primary" onClick={() => executePendingAction(action)}>
                                        Execute
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="mt-10 p-6 bg-slate-900/40 border-white/5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">IAM Audit Trail</h2>
                        <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest">Immutable account activity log</p>
                    </div>
                    <select
                        className="input bg-slate-950/40 border-white/10 w-full md:w-72"
                        value={auditUserEmail}
                        onChange={(e) => setAuditUserEmail(e.target.value)}
                    >
                        <option value="">Filter by user email</option>
                        {users.map((u) => (
                            <option key={getUserId(u)} value={u.email}>{u.email}</option>
                        ))}
                    </select>
                </div>
                <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
                    {auditLoading && <div className="text-slate-500 text-sm">Loading audit trail...</div>}
                    {!auditLoading && (auditLogs.filter((log) => !auditUserEmail || log.performedBy === auditUserEmail).slice(0, 20)).map((log) => (
                        <div key={log._id} className="flex items-start justify-between gap-4 rounded border border-white/5 bg-slate-950/40 p-3 text-xs">
                            <div>
                                <div className="text-white font-semibold">{log.action}</div>
                                <div className="text-slate-500">{log.details || "No details"}</div>
                                <div className="text-slate-600 mt-1">By: {log.performedBy}</div>
                            </div>
                            <div className="text-slate-500 font-mono">{new Date(log.createdAt).toLocaleString()}</div>
                        </div>
                    ))}
                    {!auditLoading && auditLogs.length === 0 && (
                        <div className="text-slate-500 text-sm">No audit activity yet.</div>
                    )}
                </div>
            </Card>
        </div>
    );
}



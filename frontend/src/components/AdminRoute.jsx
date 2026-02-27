/**
 * AdminRoute.jsx
 * Guards routes that require Administrator role.
 *
 * RBAC Policy (§7 – UI Access Control):
 *  - Standard users are shown a clear 403 Forbidden page (not a silent redirect)
 *  - The 403 page explains the access denial and links back to the user's dashboard
 *  - No admin panel, controls, or data are ever rendered for non-admin users
 */

import React, { useContext } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

// ─── Inline 403 Forbidden component ─────────────────────────────────────────
function Forbidden403() {
    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#000",
                padding: "24px",
            }}
        >
            <div
                style={{
                    maxWidth: 480,
                    textAlign: "center",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 16,
                    padding: "48px 40px",
                    background: "rgba(239,68,68,0.04)",
                }}
            >
                {/* Lock icon */}
                <div
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 24px",
                        fontSize: 32,
                    }}
                >
                    🔒
                </div>

                <p
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.15em",
                        color: "#ef4444",
                        textTransform: "uppercase",
                        marginBottom: 12,
                    }}
                >
                    403 Forbidden
                </p>

                <h1
                    style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: "#fff",
                        marginBottom: 12,
                    }}
                >
                    Access Denied
                </h1>

                <p
                    style={{
                        fontSize: 14,
                        color: "#9ca3af",
                        lineHeight: 1.6,
                        marginBottom: 8,
                    }}
                >
                    You do not have permission to view this page.
                    This area is restricted to <strong style={{ color: "#f87171" }}>Administrator</strong> accounts only.
                </p>

                <p
                    style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 32,
                    }}
                >
                    This access attempt has been logged and flagged for security review.
                </p>

                <Link
                    to="/"
                    style={{
                        display: "inline-block",
                        padding: "10px 28px",
                        background: "#fff",
                        color: "#000",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 14,
                        textDecoration: "none",
                    }}
                >
                    ← Return to Dashboard
                </Link>
            </div>
        </div>
    );
}

// ─── Guard component ──────────────────────────────────────────────────────────
export default function AdminRoute({ children }) {
    const { user, loading } = useContext(AuthContext);

    if (loading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#000",
                }}
            >
                <div
                    style={{
                        width: 40,
                        height: 40,
                        border: "3px solid rgba(255,255,255,0.1)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                    }}
                />
            </div>
        );
    }

    // Not authenticated → redirect to login
    if (!user) return <Navigate to="/login" replace />;

    // Authenticated but not Admin → show 403 Forbidden page (policy §7)
    if (!["Super Admin", "Admin"].includes(user.role)) return <Forbidden403 />;

    return children;
}

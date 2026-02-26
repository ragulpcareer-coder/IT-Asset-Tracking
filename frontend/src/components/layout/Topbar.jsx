import React, { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Topbar({ toggleSidebar, openMobile }) {
  const { user, logout } = useContext(AuthContext);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();

  // Compute 2FA warning for Admin accounts
  const adminNeeds2FA = ["Super Admin", "Admin"].includes(user?.role) && !user?.isTwoFactorEnabled;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <>
      {/* ── Admin 2FA Must-Act Banner (sticky, cannot be dismissed) ────────── */}
      {adminNeeds2FA && (
        <div
          style={{
            background: "rgba(234,179,8,0.12)",
            borderBottom: "1px solid rgba(234,179,8,0.35)",
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: "#fbbf24", fontWeight: 500 }}>
            ⚠️ &nbsp;<strong>Security Policy:</strong> Enable Two-Factor Authentication (2FA) for your Admin account to unlock privileged actions.
          </span>
          <Link
            to="/settings"
            style={{
              padding: "4px 14px",
              background: "#d97706",
              color: "#000",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 12,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Enable 2FA →
          </Link>
        </div>
      )}

      <div className="app-topbar">
        <div className="topbar-left">
          <button onClick={openMobile} className="btn-ghost mobile-toggle" aria-label="Open menu">
            ☰
          </button>

          <button onClick={toggleSidebar} className="btn-ghost desktop-toggle" aria-label="Toggle sidebar">
            ☰
          </button>

          <div className="brand">
            <img src="/logo.svg" alt="Logo" style={{ width: 24, height: 24 }} />
            <div className="title flex items-center gap-2">
              AssetTrack
              {!isOnline && (
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                  Offline
                </span>
              )}
            </div>
          </div>

          <div className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7 }}>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></circle>
            </svg>
            <input
              placeholder="Search assets or users..."
              aria-label="Search"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value) {
                  navigate("/assets?search=" + encodeURIComponent(e.target.value));
                }
              }}
            />
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="btn-ghost"
            title="Search commands (Ctrl+K)"
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'k',
                metaKey: true,
                ctrlKey: true
              }));
            }}
          >
            ⌘K
          </button>
          <button
            className="btn-ghost"
            onClick={() => alert("You have 0 new notifications")}
          >
            🔔
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 500, fontSize: '14px' }}>{user?.name || 'User'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                {/* Role badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: 4,
                    background: ["Super Admin", "Admin"].includes(user?.role) ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)',
                    color: ["Super Admin", "Admin"].includes(user?.role) ? '#c084fc' : '#93c5fd',
                    border: `1px solid ${["Super Admin", "Admin"].includes(user?.role) ? 'rgba(168,85,247,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {user?.role || 'User'}
                </span>
                {/* 2FA indicator for Admin */}
                {["Super Admin", "Admin"].includes(user?.role) && (
                  <span
                    title={user?.isTwoFactorEnabled ? '2FA enabled' : '2FA not enabled — required for Admin'}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: 4,
                      background: user?.isTwoFactorEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.15)',
                      color: user?.isTwoFactorEnabled ? '#4ade80' : '#fbbf24',
                      border: `1px solid ${user?.isTwoFactorEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.4)'}`,
                    }}
                  >
                    {user?.isTwoFactorEnabled ? '2FA ✓' : '2FA ⚠'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={logout} className="btn secondary" style={{ marginLeft: 16, fontSize: '13px' }}>Log out</button>
        </div>
      </div>
    </>
  );
}

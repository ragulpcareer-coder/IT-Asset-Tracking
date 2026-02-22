import React, { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";

export default function Topbar({ toggleSidebar, openMobile }) {
  const { user, logout } = useContext(AuthContext);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
                alert(`Search query run for: ${e.target.value}`);
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>

      <div className="topbar-actions">
        <button
          className="btn-ghost"
          title="Search commands (Ctrl+K)"
          onClick={() => alert("Command Palette (Ctrl+K) initializing. System indexing in progress...")}
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
            <div style={{ fontSize: '12px', color: '#888' }}>{user?.role || 'Member'}</div>
          </div>
        </div>
        <button onClick={logout} className="btn secondary" style={{ marginLeft: 16, fontSize: '13px' }}>Log out</button>
      </div>
    </div>
  );
}

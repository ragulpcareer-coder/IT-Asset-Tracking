import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { label: "Dashboard", icon: "🏠", path: "/" },
    { label: "Assets", icon: "💾", path: "/assets" },
    ...(user?.role === "Admin" ? [{ label: "Cybersecurity Tracker", icon: "🛡️", path: "/security" }] : []),
    ...(user?.role === "Admin" ? [{ label: "Users", icon: "👥", path: "/users" }] : []),
    ...(user?.role === "Admin" ? [{ label: "Audit Logs", icon: "📋", path: "/audit-logs" }] : []),
    { label: "Settings", icon: "⚙", path: "/settings" },
  ];

  return (
    <>
      <div className={`sidebar-shell ${mobileOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {mobileOpen && (
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu">✕</button>
        )}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="logo-placeholder" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.svg" alt="AssetTrack Logo" style={{ width: 32, height: 32 }} />
            {!collapsed && <div style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '-0.02em', color: '#fff' }}>AssetTrack</div>}
          </div>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              title={collapsed ? item.label : ""}
              style={{ textDecoration: 'none' }}
            >
              <div className="nav-icon" style={{ opacity: isActive(item.path) ? 1 : 0.6 }}>{item.icon}</div>
              {!collapsed && <div>{item.label}</div>}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <div className="avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: '#111', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, fontSize: '12px', color: '#fff' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 500, color: '#fff', fontSize: '14px' }}>{user?.name}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{user?.role}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileOpen && <div className="sidebar-backdrop" onClick={onClose} aria-hidden />}
    </>
  );
}

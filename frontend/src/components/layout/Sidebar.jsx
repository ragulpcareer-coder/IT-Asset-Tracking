import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Enterprise Sidebar Navigation
 * Features: Mobile-responsive overlay, Role-based item generation, Active state tracking.
 */

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  // Optimized Navigation Roles (§7 UI Policy)
  const navItems = [
    { label: "Dashboard", icon: "🏠", path: "/" },
    { label: "Asset Inventory", icon: "💾", path: "/assets" },
    { label: "Lifecycle", icon: "LC", path: "/lifecycle" },
    { label: "Self Service", icon: "SS", path: "/self-service" },
    ...(["Super Admin", "Admin"].includes(user?.role) ? [
      { label: "Security Operations", icon: "🛡️", path: "/security" },
      { label: "Identity & Access", icon: "👥", path: "/users" },
      { label: "Audit Log", icon: "📋", path: "/audit-logs" }
    ] : []),
    { label: "Settings", icon: "⚙", path: "/settings" },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sidebar-backdrop lg:hidden"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 40 }}
          />
        )}
      </AnimatePresence>

      {/* Main Sidebar Shell */}
      <aside className={`app-sidebar ${collapsed ? 'compact' : ''} ${mobileOpen ? 'mobile-active' : ''}`}>
        <div className="sidebar-shell">
        {/* Branding Area */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/logo.svg" alt="AssetTrack logo" style={{ width: 20, height: 20 }} />
          </div>
          {!collapsed && (
            <div style={{ fontWeight: 800, fontSize: '18px', color: '#fff', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              AssetTrack
            </div>
          )}
        </div>

        {/* Navigation Core */}
        <nav className="sidebar-nav">
          {(Array.isArray(navItems) ? navItems : []).map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => mobileOpen && onClose()}
                aria-current={active ? "page" : undefined}
              >
                <div style={{ fontSize: '18px', opacity: active ? 1 : 0.7, width: 20, textAlign: "center" }}>{item.icon}</div>
                {!collapsed && <span style={{ fontSize: '14px', whiteSpace: "nowrap" }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Identity Footer */}
        <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="flex-center" style={{
              width: 40, height: 40, borderRadius: '12px',
              background: 'linear-gradient(45deg, #1e293b, #0f172a)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: '14px', fontWeight: 800, color: '#fff'
            }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div className="truncate" style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{user?.role}</div>
              </div>
            )}
          </div>
        </div>
        </div>
      </aside>
    </>
  );
}



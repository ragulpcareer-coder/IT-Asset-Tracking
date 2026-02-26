import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ProfessionalIcon } from "../ProfessionalIcons";
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
    { label: "Asset Matrix", icon: "💾", path: "/assets" },
    ...(["Super Admin", "Admin"].includes(user?.role) ? [
      { label: "Cyber-Forensics", icon: "🛡️", path: "/security" },
      { label: "Identity Mgmt", icon: "👥", path: "/users" },
      { label: "Audit Ledger", icon: "📋", path: "/audit-logs" }
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
      <aside
        className={`app-sidebar ${collapsed ? 'compact' : ''} ${mobileOpen ? 'mobile-active' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          boxShadow: '20px 0 50px rgba(0,0,0,0.3)'
        }}
      >
        {/* Branding Area */}
        <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="flex-center" style={{ width: 36, height: 36, background: '#fff', borderRadius: 8 }}>
            <img src="/logo.svg" alt="Logo" style={{ width: 20, height: 20 }} />
          </div>
          {!collapsed && (
            <div style={{ fontWeight: 800, fontSize: '18px', color: '#fff', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              AssetTrack
            </div>
          )}
        </div>

        {/* Navigation Core */}
        <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => mobileOpen && onClose()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  background: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  color: active ? '#fff' : '#94a3b8',
                  fontWeight: active ? 700 : 500
                }}
              >
                <div style={{ fontSize: '18px', opacity: active ? 1 : 0.6 }}>{item.icon}</div>
                {!collapsed && <span style={{ fontSize: '14px' }}>{item.label}</span>}
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
      </aside>
    </>
  );
}

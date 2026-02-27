import React, { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button, Badge } from "../UI";

/**
 * Enterprise Navigation Bar
 * Features: Security compliance banners, Connectivity monitoring, Command quick-search.
 */

export default function Topbar({ toggleSidebar, openMobile }) {
  const { user, logout } = useContext(AuthContext);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();

  // Policy: Admin accounts MUST have 2FA enabled for privileged operations.
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
      {/* --- Mandatory Security Banner (§21) --- */}
      {adminNeeds2FA && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-6 flex justify-between items-center z-[60] relative">
          <span className="text-amber-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            ⚠️ Security Policy Alert: Administrator accounts must have Multi-Factor Authentication (MFA) enabled.
          </span>
          <Link to="/settings" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '11px' }}>
            Enable MFA
          </Link>
        </div>
      )}

      <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-6">
          {/* Mobile Navigation Trigger */}
          <button onClick={openMobile} className="btn btn-ghost lg:hidden p-2" aria-label="Open global menu">☰</button>

          <div className="flex items-center gap-3">
            <div className="flex-center" style={{ width: 28, height: 28, background: '#fff', borderRadius: 6 }}>
              <img src="/logo.svg" alt="AssetTrack" style={{ width: 16, height: 16 }} />
            </div>
            <div className="font-extrabold text-white tracking-tighter uppercase text-sm">
              AssetTrack
              {!isOnline && <Badge variant="danger" className="ml-2">Offline</Badge>}
            </div>
          </div>

          {/* Quick Registry Search */}
          <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl focus-within:border-blue-500/50 transition-all w-80">
            <span className="text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Registry Lookup (Enter)..."
              className="bg-transparent border-none outline-none text-white text-xs w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value) {
                  navigate("/assets?search=" + encodeURIComponent(e.target.value));
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Action Hub */}
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }))}>
              ⌘K
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast.info("No active security alerts in your region.")}>
              🔔
            </Button>
          </div>

          <div className="h-6 w-px bg-white/10 mx-2 hidden sm:block" />

          {/* User Profile Summary */}
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white uppercase tracking-tight">{user?.name}</div>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <Badge variant={["Super Admin", "Admin"].includes(user?.role) ? "info" : "neutral"} className="px-1.5 py-0">
                  {user?.role}
                </Badge>
                {["Super Admin", "Admin"].includes(user?.role) && (
                  <div className={`w-1.5 h-1.5 rounded-full ${user?.isTwoFactorEnabled ? 'bg-green-500' : 'bg-amber-500'}`} />
                )}
              </div>
            </div>
            <button className="flex-center w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 hover:border-white/20 transition-all">
              <span className="text-sm font-black text-white">{user?.name?.charAt(0)}</span>
            </button>
            <Button variant="secondary" size="sm" onClick={logout} className="ml-2">Logout</Button>
          </div>
        </div>
      </header>
    </>
  );
}

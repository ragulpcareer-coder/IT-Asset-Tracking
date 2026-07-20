import React, { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button, Badge } from "../UI";
import { socket } from "../../services/socket";

export default function Topbar({ toggleSidebar, openMobile }) {
  const { user, logout } = useContext(AuthContext);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const notificationPanelRef = useRef(null);

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

  useEffect(() => {
    const allowPush = user?.preferences?.pushNotifications !== false;
    if (!allowPush) return;

    const onUserNotification = (payload) => {
      if (!payload) return;
      setNotifications((prev) => [payload, ...prev].slice(0, 25));
    };

    socket.on("user_notification", onUserNotification);
    return () => {
      socket.off("user_notification", onUserNotification);
    };
  }, [user?.preferences?.pushNotifications]);

  useEffect(() => {
    if (!showNotifications) return undefined;

    const handleClickOutside = (event) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showNotifications]);

  return (
    <>
<header className="topbar-shell">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            onClick={() => {
              if (window.innerWidth >= 1024) {
                toggleSidebar();
              } else {
                openMobile();
              }
            }}
            className="btn btn-ghost sidebar-icon-button topbar-action px-3"
            aria-label="Toggle menu"
          >
            Menu
          </button>

          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex-center" style={{ width: 28, height: 28, background: "#fff", borderRadius: 6 }}>
              <img src="/logo.svg" alt="AssetTrack" style={{ width: 16, height: 16 }} />
            </div>
            <div className="font-extrabold text-white tracking-tighter uppercase text-sm">
              AssetTrack
              {!isOnline && <Badge variant="danger" className="ml-2">Offline</Badge>}
            </div>
          </div>

          <div
            className="hidden min-h-11 md:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition-all w-72 lg:w-80 cursor-text"
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          >
            <span className="text-slate-500 text-sm">Search</span>
            <span className="text-slate-400 text-xs w-full truncate select-none">Registry Lookup (Cmd+K)...</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="ghost" size="sm" className="topbar-action" onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}>
              Cmd+K
            </Button>
            <Button variant="ghost" size="sm" className="topbar-action" onClick={() => setShowNotifications((p) => !p)}>
              Alerts
              {notifications.length > 0 && (
                <span className="ml-2 text-[10px] bg-red-500 text-white rounded-full px-1 min-w-[16px] text-center">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </Button>
          </div>

          <div className="h-6 w-px bg-white/10 mx-2 hidden sm:block" />

          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white uppercase tracking-tight">{user?.name}</div>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <Badge variant={["Super Admin", "Admin"].includes(user?.role) ? "info" : "neutral"} className="px-1.5 py-0">
                  {user?.role}
                </Badge>
              </div>
            </div>
            <Link to="/settings" title="User Settings" className="flex-center h-11 w-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all">
              <span className="text-sm font-black text-white">{user?.name ? user.name.charAt(0).toUpperCase() : "U"}</span>
            </Link>
            <Button variant="secondary" size="sm" className="topbar-action ml-1" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>

      {showNotifications && (
        <div ref={notificationPanelRef} className="fixed right-3 top-28 z-[90] max-h-[70vh] w-[min(92vw,360px)] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 shadow-2xl sm:right-6">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Notifications</div>
            <button onClick={() => setNotifications([])} className="text-[11px] text-cyan-400 hover:text-cyan-300">Clear</button>
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-xs text-slate-500">No notifications yet.</div>
          ) : (
            notifications.map((n, idx) => (
              <div key={`${n.id || n.createdAt}-${idx}`} className="p-3 border-b border-white/5 last:border-b-0">
                <div className="text-[11px] text-slate-300 font-bold">{n.title || n.type || "Notification"}</div>
                <div className="text-xs text-slate-400 mt-1">{n.message}</div>
                <div className="text-[10px] text-slate-500 mt-1">{new Date(n.createdAt || Date.now()).toLocaleString()}</div>
              </div>
            ))
          )}
          <div className="p-2 border-t border-white/10">
            <button onClick={() => { setShowNotifications(false); navigate("/security"); }} className="w-full text-xs text-cyan-400 hover:text-cyan-300">Open Security Monitoring</button>
          </div>
        </div>
      )}
    </>
  );
}



import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

export default function Sidebar({ collapsed }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { label: "Dashboard", icon: "📊", path: "/" },
    { label: "Assets", icon: "💻", path: "/assets" },
    ...(user?.role === "Admin" ? [{ label: "Audit Logs", icon: "📋", path: "/audit-logs" }] : []),
    { label: "Settings", icon: "⚙️", path: "/settings" },
  ];

  return (
    <div
      className={`bg-gradient-to-b from-gray-900 to-black text-white h-screen transition-all duration-300 shadow-lg ${
        collapsed ? "w-20" : "w-64"
      } fixed left-0 top-0 overflow-y-auto`}
    >
      {/* Logo */}
      <div className="p-6 font-bold text-xl border-b border-gray-800 bg-gray-800/50 sticky top-0">
        {collapsed ? "𝐈𝐓" : "🏢 IT Asset Pro"}
      </div>

      {/* Navigation */}
      <nav className="mt-6 space-y-2 px-3">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
              isActive(item.path)
                ? "bg-blue-600 text-white shadow-lg"
                : "hover:bg-gray-800 text-gray-300 cursor-pointer"
            }`}
            title={collapsed ? item.label : ""}
          >
            <span className="text-lg">{item.icon}</span>
            {!collapsed && <span className="font-medium">{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* User Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 bg-gray-800/30">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.role}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

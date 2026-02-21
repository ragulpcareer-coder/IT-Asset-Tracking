import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CommandPalette from "../CommandPalette";

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <CommandPalette />
      <div className={`app-sidebar ${collapsed ? 'compact' : ''}`}>
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      </div>

      <div className="app-content">
        <Topbar toggleSidebar={() => setCollapsed(!collapsed)} openMobile={() => setMobileOpen(true)} />
        <div className="fade-in max-w-7xl mx-auto">{children}</div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex">
      <Sidebar collapsed={collapsed} />

      <div className={`flex-1 bg-gray-100 min-h-screen transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"}`}>
        <Topbar toggleSidebar={() => setCollapsed(!collapsed)} />
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}

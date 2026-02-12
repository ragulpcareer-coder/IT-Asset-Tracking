import React, { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

export default function Topbar({ toggleSidebar }) {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm">
      <button
        onClick={toggleSidebar}
        className="text-gray-600 hover:text-black focus:outline-none"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-700">
            {user?.name || "User"}
          </p>
          <p className="text-xs text-gray-500">{user?.role || "Guest"}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <button
          onClick={logout}
          className="ml-4 text-sm text-red-600 hover:text-red-800"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

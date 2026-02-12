import React from "react";
import { assetIcons, statusIcons, actionIcons } from "../config/brandIdentity";

/**
 * Professional Icon Component
 * Replaces emoji icons with SVG-based professional icons
 * 
 * Usage:
 * <ProfessionalIcon type="laptop" size="lg" color="primary" />
 */
export const ProfessionalIcon = ({
  type = "laptop",
  size = "md",
  color = "primary",
  className = "",
  style = {},
}) => {
  const sizeMap = {
    xs: "w-4 h-4",
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-10 h-10",
    "2xl": "w-12 h-12",
  };

  const colorMap = {
    primary: "text-blue-700",
    secondary: "text-teal-700",
    accent: "text-blue-500",
    success: "text-green-700",
    warning: "text-orange-600",
    error: "text-red-700",
    neutral: "text-gray-600",
    white: "text-white",
  };

  // Map icon type to SVG
  const getIcon = () => {
    switch (type) {
      // Asset types
      case "laptop":
        return assetIcons.laptop;
      case "server":
        return assetIcons.server;
      case "phone":
        return assetIcons.phone;
      case "network":
        return assetIcons.network;
      case "monitor":
        return assetIcons.monitor;
      case "printer":
        return assetIcons.printer;
      case "router":
        return assetIcons.router;

      // Status icons
      case "active":
        return statusIcons.active;
      case "maintenance":
        return statusIcons.maintenance;
      case "deprecated":
        return statusIcons.deprecated;
      case "archived":
        return statusIcons.archived;

      // Action icons
      case "add":
        return actionIcons.add;
      case "edit":
        return actionIcons.edit;
      case "delete":
        return actionIcons.delete;
      case "search":
        return actionIcons.search;

      default:
        return '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>';
    }
  };

  return (
    <div
      className={`inline-flex items-center justify-center ${sizeMap[size]} ${colorMap[color]} ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: getIcon() }}
    />
  );
};

/**
 * Brand Logo Component
 */
export const BrandLogo = ({ variant = "main", size = "md", className = "" }) => {
  const sizeMap = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  const mainLogo = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="95" fill="none" stroke="#1B5E9B" stroke-width="2"/>
    <circle cx="100" cy="50" r="8" fill="#1B5E9B"/>
    <circle cx="140" cy="100" r="8" fill="#00897B"/>
    <circle cx="100" cy="150" r="8" fill="#1B5E9B"/>
    <circle cx="60" cy="100" r="8" fill="#00897B"/>
    <circle cx="100" cy="100" r="10" fill="#2E7BB4"/>
    <line x1="100" y1="50" x2="100" y2="90" stroke="#1B5E9B" stroke-width="2" opacity="0.5"/>
    <line x1="100" y1="110" x2="100" y2="150" stroke="#1B5E9B" stroke-width="2" opacity="0.5"/>
    <line x1="100" y1="100" x2="140" y2="100" stroke="#00897B" stroke-width="2" opacity="0.5"/>
    <line x1="60" y1="100" x2="100" y2="100" stroke="#00897B" stroke-width="2" opacity="0.5"/>
    <text x="100" y="185" font-family="Inter, sans-serif" font-size="14" font-weight="600" text-anchor="middle" fill="#1B5E9B">ASSETFLOW</text>
  </svg>`;

  const iconLogo = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="#1B5E9B" opacity="0.1"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="#1B5E9B" stroke-width="2"/>
    <circle cx="50" cy="30" r="5" fill="#1B5E9B"/>
    <circle cx="70" cy="50" r="5" fill="#00897B"/>
    <circle cx="50" cy="70" r="5" fill="#1B5E9B"/>
    <circle cx="30" cy="50" r="5" fill="#00897B"/>
    <circle cx="50" cy="50" r="6" fill="#2E7BB4"/>
    <line x1="50" y1="30" x2="50" y2="44" stroke="#1B5E9B" stroke-width="1.5" opacity="0.6"/>
    <line x1="50" y1="50" x2="70" y2="50" stroke="#00897B" stroke-width="1.5" opacity="0.6"/>
    <line x1="50" y1="56" x2="50" y2="70" stroke="#1B5E9B" stroke-width="1.5" opacity="0.6"/>
    <line x1="30" y1="50" x2="44" y2="50" stroke="#00897B" stroke-width="1.5" opacity="0.6"/>
  </svg>`;

  return (
    <div
      className={`inline-block ${sizeMap[size]} ${className}`}
      dangerouslySetInnerHTML={{
        __html: variant === "icon" ? iconLogo : mainLogo,
      }}
    />
  );
};

/**
 * Asset Status Badge with Professional Icon
 */
export const StatusBadge = ({ status, size = "md" }) => {
  const statusConfig = {
    active: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      icon: "active",
      label: "Active",
    },
    maintenance: {
      bg: "bg-orange-50",
      border: "border-orange-200",
      text: "text-orange-700",
      icon: "maintenance",
      label: "Maintenance",
    },
    deprecated: {
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-700",
      icon: "deprecated",
      label: "Deprecated",
    },
    archived: {
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-700",
      icon: "archived",
      label: "Archived",
    },
  };

  const config = statusConfig[status] || statusConfig.active;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} ${config.text}`}
    >
      <ProfessionalIcon type={config.icon} size="sm" color={status} />
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
};

/**
 * Asset Type Label with Icon
 */
export const AssetTypeLabel = ({ category, size = "md" }) => {
  const categoryMap = {
    Laptop: "laptop",
    "Desktop Computer": "monitor",
    Server: "server",
    Smartphone: "phone",
    "Mobile Device": "phone",
    "Network Device": "network",
    Router: "router",
    Printer: "printer",
    Peripheral: "printer",
  };

  const icon = categoryMap[category] || "laptop";

  const colorMap = {
    laptop: "#1B5E9B",
    monitor: "#5BA9D9",
    server: "#00796B",
    phone: "#2E7BB4",
    network: "#00897B",
    router: "#00897B",
    printer: "#F57C00",
  };

  return (
    <div className="inline-flex items-center gap-2">
      <div style={{ color: colorMap[icon] }}>
        <ProfessionalIcon type={icon} size={size} />
      </div>
      <span className="font-medium">{category}</span>
    </div>
  );
};

/**
 * Professional Header with Logo & Branding
 */
export const BrandHeader = ({ showText = true, className = "" }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BrandLogo size="md" />
      {showText && (
        <div>
          <h1 className="text-xl font-bold text-blue-900">AssetFlow</h1>
          <p className="text-xs text-blue-600 font-medium">
            Enterprise Asset Intelligence
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Role Badge with Professional Styling
 */
export const RoleBadge = ({ role }) => {
  const roleConfig = {
    Admin: {
      bg: "bg-blue-900",
      text: "text-white",
      label: "Administrator",
    },
    Manager: {
      bg: "bg-teal-700",
      text: "text-white",
      label: "Manager",
    },
    User: {
      bg: "bg-blue-600",
      text: "text-white",
      label: "User",
    },
  };

  const config = roleConfig[role] || roleConfig.User;

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
};

export default {
  ProfessionalIcon,
  BrandLogo,
  StatusBadge,
  AssetTypeLabel,
  BrandHeader,
  RoleBadge,
};

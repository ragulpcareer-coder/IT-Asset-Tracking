import React from "react";
import { Link, useLocation } from "react-router-dom";

const SEGMENT_LABELS = {
  "": "Dashboard",
  assets: "Asset Inventory",
  security: "Security Operations",
  users: "Identity & Access",
  "audit-logs": "Audit Logs",
  settings: "Settings",
};

export default function PageHeader({ title, subtitle, actions = null }) {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const breadcrumbs = [
    { label: "Workspace", path: "/" },
    ...segments.map((segment, index) => ({
      label: SEGMENT_LABELS[segment] || segment.replace(/-/g, " "),
      path: `/${segments.slice(0, index + 1).join("/")}`,
    })),
  ];

  return (
    <div className="page-header">
      <div className="page-header__meta">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.path}>
                {isLast ? (
                  <span className="text-slate-300">{crumb.label}</span>
                ) : (
                  <Link to={crumb.path}>{crumb.label}</Link>
                )}
                {!isLast && <span aria-hidden="true">/</span>}
              </React.Fragment>
            );
          })}
        </nav>
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}

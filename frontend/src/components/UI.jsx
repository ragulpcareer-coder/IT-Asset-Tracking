import React from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Enterprise UI Component Library
 * Powered by modern.css design system.
 */

// --- Button Component ---
export const Button = ({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon = null,
  className = "",
  ...props
}) => {
  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
    ghost: "btn-ghost",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base",
  };

  return (
    <motion.button
      type={type}
      onClick={!loading && !disabled ? onClick : undefined}
      disabled={disabled || loading}
      className={`btn ${variants[variant]} ${sizes[size]} ${className}`}
      whileTap={{ scale: 0.98 }}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 border-2 border-currentColor border-t-transparent rounded-full"
            style={{ borderTopColor: 'transparent' }}
          />
          {variant !== "ghost" && <span>Loading...</span>}
        </span>
      ) : (
        <>
          {icon && <span className="text-base">{icon}</span>}
          {children}
        </>
      )}
    </motion.button>
  );
};

// --- Input Component ---
export const Input = ({
  label,
  error,
  type = "text",
  placeholder = "",
  value,
  onChange,
  icon = null,
  disabled = false,
  required = false,
  className = "",
  ...props
}) => {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`input ${icon ? "pl-11" : ""} ${error ? "error" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          {...props}
        />
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 text-xs mt-1.5 font-medium"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};

// --- Card Component ---
export const Card = ({ children, className = "", onClick, ...props }) => (
  <div className={`card ${className} ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick} {...props}>
    {children}
  </div>
);

// --- Badge Component ---
export const Badge = ({ children, variant = "info", className = "" }) => {
  const variants = {
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    info: "badge-info",
  };
  return (
    <span className={`badge ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// --- Confirm Modal Component --- (UX Requirement 20)
export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", type = "danger" }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="card w-full max-w-sm bg-slate-900 border-slate-800"
        >
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-400 mb-8">{message}</p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant={type === "danger" ? "danger" : "primary"} onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Permission Guard (Security Requirement 21-30) ---
export const PermissionGuard = ({ roles = [], userRole, children, fallback = null }) => {
  if (!userRole || !roles.includes(userRole)) return fallback;
  return <>{children}</>;
};

export default {
  Button,
  Input,
  Card,
  Badge,
  ConfirmModal,
  PermissionGuard,
};

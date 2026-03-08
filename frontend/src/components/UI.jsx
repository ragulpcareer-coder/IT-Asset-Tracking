import React from "react";
import { motion, AnimatePresence } from "framer-motion";

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
    success: "btn-primary",
    outline: "btn-ghost",
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
      className={`btn ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      whileTap={{ scale: 0.98 }}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 border-2 border-currentColor border-t-transparent rounded-full"
            style={{ borderTopColor: "transparent" }}
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

export const Card = ({ children, className = "", onClick, ...props }) => (
  <div className={`card ${className} ${onClick ? "cursor-pointer" : ""}`} onClick={onClick} {...props}>
    {children}
  </div>
);

export const Badge = ({ children, variant = "info", className = "" }) => {
  const variants = {
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    info: "badge-info",
    ghost: "badge-info",
  };

  return <span className={`badge ${variants[variant] || variants.info} ${className}`}>{children}</span>;
};

export const ConfirmModal = ({
  isOpen,
  title,
  message,
  children = null,
  onConfirm,
  onCancel,
  onClose,
  confirmText = "Confirm",
  type = "danger",
  confirmDisabled = false,
  confirmLoading = false,
}) => {
  const handleCancel = onCancel || onClose || (() => {});

  return (
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
            {message && <p className="text-sm text-slate-400 mb-4">{message}</p>}
            {children && <div className="mb-6">{children}</div>}
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
              <Button
                variant={type === "danger" ? "danger" : type === "success" ? "success" : "primary"}
                onClick={onConfirm}
                disabled={confirmDisabled}
                loading={confirmLoading}
              >
                {confirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const Alert = ({ type = "info", title, message, onClose, className = "" }) => {
  const variants = {
    success: "bg-green-500/10 border-green-500/50 text-green-400",
    error: "bg-red-500/10 border-red-500/50 text-red-400",
    warning: "bg-yellow-500/10 border-yellow-500/50 text-yellow-400",
    info: "bg-blue-500/10 border-blue-500/50 text-blue-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-4 rounded-lg border backdrop-blur-md flex items-start gap-3 ${variants[type] || variants.info} ${className}`}
    >
      <div className="flex-1">
        {title && <h4 className="font-bold text-sm mb-1">{title}</h4>}
        <p className="text-xs opacity-90">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="opacity-50 hover:opacity-100 transition" aria-label="close alert">
          x
        </button>
      )}
    </motion.div>
  );
};

export const PermissionGuard = ({ roles = [], userRole, children, fallback = null }) => {
  if (!userRole || !roles.includes(userRole)) return fallback;
  return <>{children}</>;
};

export const PasswordStrengthMeter = ({ password }) => {
  const getStrength = (pass) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass) && /[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = getStrength(password || "");
  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];

  return (
    <div className="mt-2">
      <div className="flex gap-1 h-1.5 mb-1.5">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`flex-1 rounded-full transition-all duration-500 ${step <= strength ? colors[strength - 1] : "bg-white/10"}`}
          />
        ))}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
        Security Level:{" "}
        <span className={strength > 0 ? colors[strength - 1].replace("bg-", "text-") : ""}>
          {password ? labels[strength - 1] : "Pending Input"}
        </span>
      </p>
    </div>
  );
};

export default {
  Button,
  Input,
  Card,
  Badge,
  Alert,
  PasswordStrengthMeter,
  ConfirmModal,
  PermissionGuard,
};

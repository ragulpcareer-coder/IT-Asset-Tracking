import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Button = React.forwardRef(({
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
}, ref) => {
  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
    ghost: "btn-ghost",
    success: "btn-primary",
    outline: "btn-secondary",
  };

  const sizes = {
    sm: "px-3.5 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={!loading && !disabled ? onClick : undefined}
      disabled={disabled || loading}
      className={`btn ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      whileTap={disabled || loading ? undefined : { scale: 0.98 }}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      aria-busy={loading}
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
});

Button.displayName = "Button";

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
  inputClassName = "",
  ...props
}) => {
  const generatedId = React.useId();
  const inputId = props.id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const existingDescribedBy = props["aria-describedby"];
  const describedBy = [existingDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="label" htmlFor={inputId}>
          {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`input ${icon ? "pl-11" : ""} ${error ? "error" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${inputClassName}`}
          {...props}
        />
      </div>
      {error && (
        <motion.p
          id={errorId}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 text-xs mt-1.5 font-medium"
          role="alert"
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
  const titleId = React.useId();
  const messageId = React.useId();
  const modalRef = React.useRef(null);
  const cancelButtonRef = React.useRef(null);

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const previousActive = document.activeElement;
    const focusFirst = () => {
      const focusable = modalRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable?.length) {
        focusable[0].focus();
      } else {
        cancelButtonRef.current?.focus();
      }
    };

    focusFirst();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActive?.focus?.();
    };
  }, [handleCancel, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCancel();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="card w-full max-w-sm bg-slate-900 border-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={message ? messageId : undefined}
            ref={modalRef}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 id={titleId} className="text-lg font-bold text-white mb-2">{title}</h3>
            {message && <p id={messageId} className="text-sm text-slate-400 mb-4">{message}</p>}
            {children && <div className="mb-6">{children}</div>}
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={handleCancel} ref={cancelButtonRef}>Cancel</Button>
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
    success: "bg-emerald-500/10 border-emerald-400/40 text-emerald-200",
    error: "bg-rose-500/10 border-rose-400/40 text-rose-100",
    warning: "bg-amber-500/10 border-amber-400/40 text-amber-100",
    info: "bg-sky-500/10 border-sky-400/40 text-sky-100",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-4 rounded-2xl border backdrop-blur-md flex items-start gap-3 ${variants[type] || variants.info} ${className}`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <div className="flex-1">
        {title && <h4 className="font-bold text-sm mb-1">{title}</h4>}
        <p className="text-xs opacity-90">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="rounded-full p-1 opacity-60 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60" aria-label="close alert">
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

import React from "react";
import { motion } from "framer-motion";
import { theme } from "../config/theme";
import { animationVariants, transitionPresets } from "../utils/animations";

// Modern Button Component
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
    primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/50",
    secondary:
      "bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300",
    danger: "bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-lg hover:shadow-red-500/50",
    success:
      "bg-gradient-to-r from-green-600 to-green-700 text-white hover:shadow-lg hover:shadow-green-500/50",
    outline:
      "border-2 border-blue-600 text-blue-600 hover:bg-blue-50 bg-transparent",
    ghost: "text-blue-600 hover:bg-blue-50 bg-transparent",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm font-medium rounded-md",
    md: "px-4 py-2.5 text-base font-semibold rounded-lg",
    lg: "px-6 py-3 text-lg font-semibold rounded-lg",
    xl: "px-8 py-4 text-xl font-bold rounded-xl",
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition-all font-medium ${sizes[size]} ${
        variants[variant]
      } ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      whileHover={!disabled && !loading ? animationVariants.buttonHover : {}}
      whileTap={!disabled && !loading ? animationVariants.buttonTap : {}}
      {...props}
    >
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
        />
      )}
      {icon && <span className="text-lg">{icon}</span>}
      {children}
    </motion.button>
  );
};

// Modern Input Component with validation
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
  hint = "",
  className = "",
  ...props
}) => {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <motion.div
        className="relative"
        animate={isFocused ? { boxShadow: "0 0 20px rgba(59, 130, 246, 0.2)" } : {}}
      >
        {icon && (
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full px-4 py-2.5 ${icon ? "pl-10" : "pl-4"} border-2 rounded-lg transition-all focus:outline-none ${
            error ? "border-red-500 focus:border-red-600" : "border-gray-200 focus:border-blue-500"
          } ${disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "bg-white"} ${className}`}
          {...props}
        />
      </motion.div>
      {error && <p className="text-red-500 text-sm mt-1.5 font-medium">{error}</p>}
      {hint && !error && <p className="text-gray-500 text-xs mt-1.5">{hint}</p>}
    </div>
  );
};

// Password Strength Indicator
export const PasswordStrengthMeter = ({ password, requirements = [] }) => {
  const getStrengthPercentage = (pwd) => {
    let percentage = 0;
    if (pwd.length >= 8) percentage += 20;
    if (pwd.length >= 12) percentage += 20;
    if (/[A-Z]/.test(pwd)) percentage += 15;
    if (/[a-z]/.test(pwd)) percentage += 15;
    if (/[0-9]/.test(pwd)) percentage += 15;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) percentage += 15;
    return Math.min(percentage, 100);
  };

  const percentage = getStrengthPercentage(password);
  const getColor = () => {
    if (percentage < 20) return "bg-red-500";
    if (percentage < 40) return "bg-orange-500";
    if (percentage < 60) return "bg-yellow-500";
    if (percentage < 80) return "bg-lime-500";
    return "bg-green-500";
  };

  const getLabel = () => {
    if (percentage < 20) return "Very Weak";
    if (percentage < 40) return "Weak";
    if (percentage < 60) return "Fair";
    if (percentage < 80) return "Good";
    return "Strong";
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-600">Password Strength</span>
        <span className={`text-xs font-bold ${getColor().replace("bg-", "text-")}`}>
          {getLabel()}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <motion.div
          className={`h-full ${getColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      {requirements.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {requirements.map((req) => (
            <motion.div
              key={req.id}
              className="flex items-center gap-2 text-xs"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs ${
                  req.check(password) ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                {req.check(password) ? "✓" : "○"}
              </span>
              <span className={req.check(password) ? "text-green-600 font-medium" : "text-gray-500"}>
                {req.label}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// Modern Card Component
export const Card = ({
  children,
  className = "",
  onClick = null,
  variant = "default",
  ...props
}) => {
  const variants = {
    default: "bg-white border border-gray-200",
    elevated: "bg-white shadow-lg",
    outlined: "bg-transparent border-2 border-gray-300",
    gradient: "bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200",
  };

  return (
    <motion.div
      className={`rounded-xl p-6 transition-all ${variants[variant]} ${
        onClick ? "cursor-pointer hover:shadow-lg" : ""
      } ${className}`}
      whileHover={onClick ? animationVariants.cardHover : {}}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Loading Skeleton
export const Skeleton = ({ count = 1, height = "h-6", className = "" }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={`${height} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg ${className}`}
          animate={animationVariants.shimmer}
          style={{
            backgroundSize: "200% 100%",
          }}
        />
      ))}
    </div>
  );
};

// Badge Component
export const Badge = ({
  children,
  variant = "default",
  icon = null,
  size = "md",
  className = "",
}) => {
  const variants = {
    default: "bg-blue-100 text-blue-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    info: "bg-cyan-100 text-cyan-800",
    neutral: "bg-gray-100 text-gray-800",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <motion.span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${sizes[size]} ${variants[variant]} ${className}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={transitionPresets.bouncy}
    >
      {icon && <span>{icon}</span>}
      {children}
    </motion.span>
  );
};

// Alert Component
export const Alert = ({
  type = "info",
  title,
  message,
  onClose,
  icon = null,
  className = "",
}) => {
  const types = {
    success: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
      icon: "✓",
    },
    error: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
      icon: "✕",
    },
    warning: {
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      text: "text-yellow-800",
      icon: "⚠",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
      icon: "ℹ",
    },
  };

  const config = types[type];

  return (
    <motion.div
      className={`${config.bg} ${config.border} border rounded-lg p-4 ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="flex items-start gap-3">
        <span className={`text-xl font-bold ${config.text}`}>{icon || config.icon}</span>
        <div className="flex-1">
          {title && <h3 className={`font-semibold ${config.text}`}>{title}</h3>}
          <p className={`text-sm ${config.text} mt-1`}>{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`text-lg font-bold ${config.text} hover:opacity-70 transition`}
          >
            ✕
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default {
  Button,
  Input,
  PasswordStrengthMeter,
  Card,
  Skeleton,
  Badge,
  Alert,
};

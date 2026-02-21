import React from "react";
import { motion } from "framer-motion";

// Lightweight background: subtle gradient with slow float animation
export const QuantumBackground = ({ className = "" }) => {
  return (
    <div
      className={"fixed inset-0 -z-10 " + className}
      style={{
        background: "linear-gradient(180deg,#071229 0%, #071a2f 60%, #041027 100%)",
        opacity: 0.7,
        pointerEvents: "none",
      }}
    />
  );
};

// Simple card wrapper that preserves props used across the app
export const FutureCard = ({ children, className = "", accentColor = "#06b6d4", delay = 0, fullWidth = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      className={`card ${fullWidth ? "w-full" : ""} ${className}`}
      style={{ borderColor: "rgba(255,255,255,0.03)" }}
    >
      {children}
    </motion.div>
  );
};

// Simple gradient text animation but lightweight
export const SpectrumText = ({ children, className = "", delay = 0 }) => {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      style={{
        background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      {children}
    </motion.span>
  );
};

// Lightweight button that maps to the new theme classes
export const QuantumButton = ({ children, onClick, variant = "primary", size = "md", className = "", disabled }) => {
  const sizeMap = { sm: "px-4 py-2 text-sm", md: "px-6 py-3", lg: "px-8 py-3 text-lg" };
  const variantMap = {
    primary: "btn",
    secondary: "btn secondary",
    ghost: "btn-ghost",
  };

  return (
    <motion.button
      onClick={onClick}
      className={`${variantMap[variant] || "btn"} ${sizeMap[size] || sizeMap.md} ${className}`}
      whileTap={{ scale: 0.98 }}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
};

export const HolographicPanel = ({ children, title, accentColor = "#06b6d4" }) => (
  <div className="card">
    {title && <div style={{ marginBottom: 8, fontWeight: 700 }}>{title}</div>}
    <div>{children}</div>
  </div>
);

export const GradientMesh = ({ className = "" }) => null;

export default {
  QuantumBackground,
  FutureCard,
  SpectrumText,
  QuantumButton,
  HolographicPanel,
  GradientMesh,
};

import React from "react";
import { motion } from "framer-motion";

// Lightweight background replacement — subtle gradient layer
export const Background3D = ({ variant = "default", className = "" }) => {
  return (
    <div
      className={`fixed inset-0 -z-10 ${className}`}
      style={{
        background: "linear-gradient(180deg,#071229 0%, #071a2f 60%, #041027 100%)",
        opacity: 0.7,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * 3D Floating Card Component for Dashboard
 */
export const Card3D = ({ children, className = "", style = {}, delay = 0 }) => {
  return (
    <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay, duration: 0.35 }} className={className} style={style}>
      {children}
    </motion.div>
  );
};

/**
 * Animated Floating Elements
 */
export const FloatingElement = ({ children, delay = 0, duration = 4, className = "" }) => {
  return (
    <motion.div initial={{ y: 0 }} animate={{ y: [-8, 8, -8] }} transition={{ delay, duration, repeat: Infinity, ease: "easeInOut" }} className={className}>
      {children}
    </motion.div>
  );
};

/**
 * Glowing Orb Component - Represents IT Assets
 */
export const GlowingOrb = ({ color = "#1B5E9B", size = 48, className = "", delay = 0 }) => {
  return (
    <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ delay, duration: 3, repeat: Infinity }} className={className} style={{ width: size, height: size, borderRadius: 9999, background: `linear-gradient(135deg, ${color}, rgba(0,0,0,0.15))`, boxShadow: `0 8px 24px ${color}33` }} />
  );
};

/**
 * Tech Grid Background
 */
export const TechGrid = ({ className = "" }) => {
  return <div className={className} style={{ position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none", backgroundSize: "40px 40px", backgroundImage: `linear-gradient(0deg, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)` }} />;
};

/**
 * Holographic Effect Component
 */
export const HolographicCard = ({ children, className = "", delay = 0 }) => {
  return (
    <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay, duration: 0.35 }} className={className} style={{ borderRadius: 16, overflow: "hidden", background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))", border: "1px solid rgba(255,255,255,0.03)" }}>
      {children}
    </motion.div>
  );
};

export default {
  Background3D,
  Card3D,
  FloatingElement,
  GlowingOrb,
  TechGrid,
  HolographicCard,
};

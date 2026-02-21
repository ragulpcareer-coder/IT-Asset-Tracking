// FUTURISTIC UI COMPONENT SHOWCASE & REFERENCE
// Complete implementation examples for all premium components

import React from "react";
import { motion } from "framer-motion";
import {
  QuantumBackground,
  FutureCard,
  SpectrumText,
  QuantumButton,
  HolographicPanel,
  GradientMesh,
} from "./components/FuturisticUI";

/**
 * ============================================================================
 *                     COMPONENT SHOWCASE EXAMPLES
 * ============================================================================
 */

// ========================== EXAMPLE 1: QUANTUM BACKGROUND ==========================
// Use this for immersive page backgrounds with interactive particles
export const QuantumBackgroundExample = () => {
  return (
    <div className="relative w-full h-screen bg-[#0a1128] overflow-hidden">
      {/* Quantum particles that follow cursor */}
      <QuantumBackground />

      {/* Content overlay */}
      <div className="relative z-10 flex items-center justify-center h-full">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-5xl font-black text-cyan-300">Quantum Background</h1>
          <p className="text-white/60 mt-4">80+ particles with magnetic field physics</p>
        </motion.div>
      </div>
    </div>
  );
};

// ========================== EXAMPLE 2: PREMIUM CARD ==========================
// Use for information containers with adaptive depth
export const FutureCardExample = () => {
  return (
    <div className="p-8 space-y-6">
      <FutureCard accentColor="#00d4ff" delay={0}>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Premium Card Title</h2>
          <p className="text-white/70">
            This card features multi-layer depth, animated corner accents, and dynamic glowing borders.
          </p>
          <div className="flex gap-3 pt-4">
            <QuantumButton variant="primary">Action</QuantumButton>
            <QuantumButton variant="secondary">Cancel</QuantumButton>
          </div>
        </div>
      </FutureCard>

      {/* Multiple cards with staggered animation */}
      <div className="grid grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <FutureCard key={i} accentColor={["#00d4ff", "#ff006e", "#00ff88", "#ffa500"][i]} delay={i * 0.15}>
            <h3 className="text-lg font-bold text-white">Card {i + 1}</h3>
            <p className="text-white/60 mt-2">Hover to see depth effect</p>
          </FutureCard>
        ))}
      </div>
    </div>
  );
};

// ========================== EXAMPLE 3: SPECTRUM TEXT ==========================
// Use for eye-catching typography with per-letter animation
export const SpectrumTextExample = () => {
  return (
    <div className="p-8 space-y-8 bg-[#0a1128] min-h-screen">
      <div>
        <SpectrumText className="text-4xl font-black mb-4" delay={0}>
          UNIMAGINABLE DESIGN
        </SpectrumText>
        <p className="text-white/60">Each letter animates individually with spectrum gradients</p>
      </div>

      <div>
        <SpectrumText className="text-3xl font-bold mb-4" delay={0.1}>
          Premium Typography
        </SpectrumText>
        <p className="text-white/60">Glowing text with interactive hover effects</p>
      </div>

      <div>
        <SpectrumText className="text-2xl font-semibold mb-4" delay={0.2}>
          Fabulous Animations
        </SpectrumText>
        <p className="text-white/60">Staggered entrance with spring physics</p>
      </div>
    </div>
  );
};

// ========================== EXAMPLE 4: QUANTUM BUTTON ==========================
// Use for primary actions with particle burst effects
export const QuantumButtonExample = () => {
  const handleClick = () => {
    console.log("Button clicked!");
  };

  return (
    <div className="p-12 space-y-8 bg-gradient-to-b from-[#0a1128] to-[#1a0f2e] min-h-screen">
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Primary Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <QuantumButton variant="primary" size="sm" onClick={handleClick}>
            Small
          </QuantumButton>
          <QuantumButton variant="primary" size="md" onClick={handleClick}>
            Medium
          </QuantumButton>
          <QuantumButton variant="primary" size="lg" onClick={handleClick}>
            Large
          </QuantumButton>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Secondary Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <QuantumButton variant="secondary" size="md" onClick={handleClick}>
            Secondary
          </QuantumButton>
          <QuantumButton variant="tertiary" size="md" onClick={handleClick}>
            Tertiary
          </QuantumButton>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Button States</h2>
        <div className="flex gap-4">
          <QuantumButton variant="primary" onClick={handleClick}>
            Ready to Click
          </QuantumButton>
          <QuantumButton variant="primary" disabled>
            Disabled
          </QuantumButton>
        </div>
      </div>
    </div>
  );
};

// ========================== EXAMPLE 5: HOLOGRAPHIC PANEL ==========================
// Use for data display with digital aesthetic
export const HolographicPanelExample = () => {
  return (
    <div className="p-8 space-y-6 bg-[#0a1128] min-h-screen">
      <HolographicPanel title="System Status" accentColor="#00d4ff">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-white">Server Status:</span>
            <span className="text-green-400 font-bold">ONLINE</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white">CPU Usage:</span>
            <span className="text-cyan-300">43%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white">Memory:</span>
            <span className="text-cyan-300">2.4 GB / 8 GB</span>
          </div>
        </div>
      </HolographicPanel>

      <HolographicPanel title="Analytics" accentColor="#ff006e">
        <div className="space-y-3">
          <div className="space-y-2">
            <span className="text-white text-sm">Active Users</span>
            <div className="w-full bg-gray-800/50 rounded h-2">
              <div className="bg-gradient-to-r from-pink-500 to-red-500 h-full rounded" style={{ width: "73%" }} />
            </div>
            <span className="text-gray-400 text-xs">1,246 users</span>
          </div>
        </div>
      </HolographicPanel>

      <HolographicPanel title="Network Activity" accentColor="#00ff88">
        <div className="text-white text-sm space-y-2">
          <div>Upload: 2.4 Mbps</div>
          <div>Download: 8.7 Mbps</div>
          <div>Latency: 12ms</div>
        </div>
      </HolographicPanel>
    </div>
  );
};

// ========================== EXAMPLE 6: GRADIENT MESH ==========================
// Use for interactive background effects
export const GradientMeshExample = () => {
  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-[#0a1128] to-[#1a0f2e]">
      <GradientMesh />

      <div className="relative z-10 flex items-center justify-center h-full">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h1 className="text-5xl font-black text-white mb-4">Gradient Mesh</h1>
          <p className="text-white/60">Move your mouse over the mesh for interactive distortion</p>
        </motion.div>
      </div>
    </div>
  );
};

// ========================== EXAMPLE 7: COMPLETE DASHBOARD ==========================
// Professional dashboard using all components together
export const CompleteDashboardExample = () => {
  return (
    <div className="relative w-full min-h-screen bg-[#0a1128] overflow-hidden">
      {/* Background */}
      <QuantumBackground className="z-0" />

      {/* Content */}
      <div className="relative z-10 p-8">
        {/* Header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <SpectrumText className="text-5xl font-black mb-2">Dashboard</SpectrumText>
          <p className="text-white/60">Your enterprise asset management hub</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[
            { title: "Active Assets", value: "2,847", accent: "#00d4ff" },
            { title: "Active Users", value: "156", accent: "#ff006e" },
            { title: "System Health", value: "94%", accent: "#00ff88" },
          ].map((stat, i) => (
            <FutureCard key={i} accentColor={stat.accent} delay={i * 0.1}>
              <h3 className="text-white/60 text-sm mb-3">{stat.title}</h3>
              <p className="text-3xl font-black text-white">{stat.value}</p>
            </FutureCard>
          ))}
        </div>

        {/* Data Panel */}
        <HolographicPanel title="System Overview" accentColor="#00d4ff">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-white">CPU:</span>
              <span className="text-cyan-300">45%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white">Memory:</span>
              <span className="text-cyan-300">62%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white">Storage:</span>
              <span className="text-cyan-300">78%</span>
            </div>
            <div className="pt-4 flex gap-3">
              <QuantumButton variant="primary" size="md">
                Details
              </QuantumButton>
              <QuantumButton variant="secondary" size="md">
                Export
              </QuantumButton>
            </div>
          </div>
        </HolographicPanel>
      </div>
    </div>
  );
};

// ========================== EXAMPLE 8: LOGIN FORM ==========================
// Premium login interface with all effects
export const LoginFormExample = () => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  return (
    <div className="relative w-full min-h-screen bg-[#0a1128] overflow-hidden flex items-center justify-center">
      <QuantumBackground className="z-0" />

      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <SpectrumText className="text-4xl font-black mb-2">Welcome</SpectrumText>
          <p className="text-cyan-300 text-sm">Premium Enterprise Login</p>
        </motion.div>

        <FutureCard accentColor="#00d4ff" fullWidth>
          <form className="space-y-5">
            <div>
              <label className="block text-cyan-300 text-sm font-bold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 backdrop-blur border-2 border-cyan-500/30 focus:border-cyan-400 text-white placeholder-white/30 focus:outline-none transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-cyan-300 text-sm font-bold mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 backdrop-blur border-2 border-cyan-500/30 focus:border-cyan-400 text-white placeholder-white/30 focus:outline-none transition"
                placeholder="••••••••"
              />
            </div>

            <QuantumButton variant="primary" size="lg" className="w-full mt-6">
              Sign In
            </QuantumButton>
          </form>
        </FutureCard>

        <p className="text-center text-white/40 text-xs mt-8">
          Secure. Private. Premium.
        </p>
      </div>
    </div>
  );
};

// ========================== EXPORT ALL EXAMPLES ==========================
export const UIComponentShowcase = {
  QuantumBackground: QuantumBackgroundExample,
  FutureCard: FutureCardExample,
  SpectrumText: SpectrumTextExample,
  QuantumButton: QuantumButtonExample,
  HolographicPanel: HolographicPanelExample,
  GradientMesh: GradientMeshExample,
  CompleteDashboard: CompleteDashboardExample,
  LoginForm: LoginFormExample,
};

export default UIComponentShowcase;

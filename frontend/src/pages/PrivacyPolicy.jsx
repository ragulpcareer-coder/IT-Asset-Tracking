import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { QuantumBackground, FutureCard } from "../components/FuturisticUI";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen w-full overflow-hidden relative bg-[#0a1128]">
      <QuantumBackground className="z-0" />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <motion.div className="w-full max-w-3xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <FutureCard accentColor="#00d4ff" fullWidth>
            <h1 className="text-3xl font-black text-cyan-200 mb-4">Privacy Policy</h1>
            <p className="text-blue-100/90 mb-4">AssetTrack stores account information, security events, and audit activity required for authentication, authorization, and compliance reporting.</p>
            <p className="text-blue-100/90 mb-4">Security metadata such as IP address, user-agent, and session behavior is collected to protect your account and detect suspicious activity.</p>
            <Link to="/register" className="text-cyan-400 hover:text-cyan-300 text-sm">Back to Registration</Link>
          </FutureCard>
        </motion.div>
      </div>
    </div>
  );
}

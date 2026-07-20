import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function PrivacyPolicy() {
  return (
    <div className="auth-shell">
      <div className="auth-shell__inner">
        <motion.div
          className="auth-shell__panel"
          style={{ maxWidth: 640 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="auth-shell__content">
            <h1 className="auth-shell__title" style={{ fontSize: "1.75rem" }}>Privacy Policy</h1>
            <p className="auth-shell__subtitle">
              AssetTrack stores account information, security events, and audit activity required
              for authentication, authorization, and compliance reporting.
            </p>
            <p className="auth-shell__subtitle">
              Security metadata such as IP address, user-agent, and session behavior is collected
              to protect your account and detect suspicious activity.
            </p>
            <div className="auth-shell__footer" style={{ marginTop: 24 }}>
              <Link to="/register" style={{ color: "var(--secondary)" }}>Back to Registration</Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

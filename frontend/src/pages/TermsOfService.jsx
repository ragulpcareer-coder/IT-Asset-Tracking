import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function TermsOfService() {
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
            <h1 className="auth-shell__title" style={{ fontSize: "1.75rem" }}>Terms of Service</h1>
            <p className="auth-shell__subtitle">
              By using AssetTrack, you agree to use the platform responsibly, protect your account
              credentials, and follow your organization's security policy.
            </p>
            <p className="auth-shell__subtitle">
              Unauthorized access, tampering, and misuse of audit data are prohibited.
              Administrator actions are logged for compliance and forensic review.
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

import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Background3D, TechGrid } from "./3DBackground";
import { BrandLogo } from "./ProfessionalIcons";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer = null,
  maxWidth = "max-w-lg",
  badge = "Secure Access",
}) {
  return (
    <div className="auth-shell">
      <Background3D className="z-0" />
      <TechGrid className="z-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 bg-[radial-gradient(circle_at_top,rgba(79,156,255,0.18),transparent_52%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 z-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(51,196,141,0.16),transparent_60%)] blur-3xl" />

      <div className="auth-shell__inner">
        <motion.div
          className={`w-full ${maxWidth}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <div className="auth-shell__panel">
            <div className="auth-shell__content">
              <div className="auth-shell__brand">
                <Link to="/" className="inline-flex items-center justify-center rounded-2xl p-2 transition hover:bg-white/5">
                  <BrandLogo variant="icon" size="lg" />
                </Link>
                <div className="mt-4">
                  <span className="auth-shell__eyebrow">{badge}</span>
                </div>
                <h1 className="auth-shell__title">{title}</h1>
                {subtitle ? <p className="auth-shell__subtitle">{subtitle}</p> : null}
              </div>

              {children}
            </div>
          </div>

          {footer ? <div className="auth-shell__footer">{footer}</div> : null}
        </motion.div>
      </div>
    </div>
  );
}

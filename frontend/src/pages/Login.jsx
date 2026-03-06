import React, { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Input, Alert } from "../components/UI";
import { validateEmail } from "../utils/validation";
import { theme } from "../config/theme";
import { QuantumBackground, SpectrumText, QuantumButton, FutureCard } from "../components/FuturisticUI";
import "../modern.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token2FA, setToken2FA] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);
  const { login, verify2FA } = useContext(AuthContext);
  const navigate = useNavigate();


  const validateForm = () => {
    const newErrors = { email: "", password: "" };
    let isValid = true;

    if (!email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = "Password must be 8+ characters";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleBack = () => {
    setRequires2FA(false);
    setToken2FA("");
    setError("");
    setTempUserId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!requires2FA && !validateForm()) return;
    if (requires2FA && !token2FA.trim()) {
      setError("Please enter your 6-digit authenticator code.");
      return;
    }

    try {
      setLoading(true);
      // Enterprise Device Fingerprinting (Policy §2.4)
      const fingerprint = {
        browser: navigator.userAgent,
        language: navigator.language,
        resolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      if (!requires2FA) {
        // Step 1: Initial Login (Email/Password)
        const data = await login(email, password, "", fingerprint);
        if (data.requires2FA) {
          setRequires2FA(true);
          setTempUserId(data.userId);
          setError(""); // Clear any previous password errors
        } else {
          // Success (No 2FA)
          navigate("/");
        }
      } else {
        // Step 2: 2FA Verification
        await verify2FA(tempUserId, token2FA);
        navigate("/");
      }
    } catch (err) {
      const data = err.response?.data;
      // We still handle data.requires2FA in catch just in case backend returns 401
      if (data?.requires2FA && !requires2FA) {
        setRequires2FA(true);
        setTempUserId(data.userId);
        setError("");
      } else if (requires2FA) {
        // Already on 2FA screen — show inline error
        setError(data?.message || "Invalid 2FA code. Please try again.");
        setToken2FA("");
      } else if (data?.code === "2FA_SECRET_CORRUPT") {
        setError(data?.message || "2FA is misconfigured. Contact admin.");
        setRequires2FA(false);
      } else {
        setError(data?.message || "Login failed. Please check credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-hidden relative bg-[#0a1128]">
      {/* QUANTUM PARTICLE BACKGROUND */}
      <QuantumBackground className="z-0" />

      {/* ANIMATED GRID OVERLAY */}
      <motion.div
        className="absolute inset-0 z-1 opacity-20"
        style={{
          backgroundImage: "linear-gradient(0deg, transparent 24%, rgba(0, 212, 255, 0.1) 25%, rgba(0, 212, 255, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 212, 255, 0.1) 75%, rgba(0, 212, 255, 0.1) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 212, 255, 0.1) 25%, rgba(0, 212, 255, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 212, 255, 0.1) 75%, rgba(0, 212, 255, 0.1) 76%, transparent 77%, transparent)",
          backgroundSize: "50px 50px",
          pointerEvents: "none",
        }}
        animate={{
          backgroundPosition: ["0px 0px", "50px 50px"],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* GLOWING CORNER ACCENTS */}
      {[0, 1, 2, 3].map((corner) => (
        <motion.div
          key={corner}
          className="absolute w-40 h-40 opacity-30 pointer-events-none"
          style={{
            top: corner < 2 ? -20 : "auto",
            bottom: corner >= 2 ? -20 : "auto",
            left: corner % 2 === 0 ? -20 : "auto",
            right: corner % 2 === 1 ? -20 : "auto",
            background: corner === 0 ? "radial-gradient(circle, rgba(0, 212, 255, 0.4), transparent)" :
              corner === 1 ? "radial-gradient(circle, rgba(100, 50, 255, 0.4), transparent)" :
                corner === 2 ? "radial-gradient(circle, rgba(255, 0, 110, 0.4), transparent)" :
                  "radial-gradient(circle, rgba(0, 255, 136, 0.4), transparent)",
            filter: "blur(40px)",
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            delay: corner * 1.5,
          }}
        />
      ))}

      {/* MAIN CONTENT CONTAINER */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
        >
          {/* HEADER WITH ANIMATED TITLE */}
          <div className="mb-12 text-center">
            <motion.div
              className="mb-6 inline-block"
              animate={{
                rotate: [0, 5, -5, 0],
              }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0a1128] via-[#1e293b] to-[#0f172a] flex items-center justify-center relative border border-cyan-500/30 overflow-hidden shadow-[0_0_20px_rgba(0,212,255,0.3)]">
                <motion.img
                  src="/logo.svg"
                  alt="AssetTrack Logo"
                  className="w-16 h-16 relative z-10"
                  animate={{
                    opacity: [0.8, 1, 0.8],
                    scale: [0.95, 1.05, 0.95]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
            </motion.div>

            <motion.h1
              className="text-4xl font-black mb-3 relative"
              style={{
                background: "linear-gradient(90deg, #00d4ff, #6432ff, #ff006e, #00d4ff)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
              animate={{
                backgroundPosition: ["0% center", "200% center"],
              }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              Welcome Back
            </motion.h1>

            <motion.p
              className="text-cyan-300 text-sm font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Unlock your asset management dashboard
            </motion.p>
          </div>

          {/* PREMIUM CARD CONTAINER */}
          <FutureCard accentColor="#00d4ff" delay={0.2} fullWidth>
            {/* ERROR ALERT */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 backdrop-blur"
              >
                <p className="text-red-300 text-sm font-medium">{error}</p>
              </motion.div>
            )}

            {/* LOGIN FORM */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* EMAIL INPUT */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <label className="block text-cyan-300 text-sm font-semibold mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <motion.input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 backdrop-blur border-2 transition-all duration-300 text-white placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    style={{
                      borderColor: isEmailFocused ? "#00d4ff" : "rgba(100, 200, 255, 0.3)",
                      boxShadow: isEmailFocused ? "0 0 20px rgba(0, 212, 255, 0.3)" : "none",
                    }}
                    placeholder="Enter your registered email"
                    whileFocus={{
                      scale: 1.02,
                    }}
                  />
                  {isEmailFocused && (
                    <motion.div
                      className="absolute inset-0 rounded-lg pointer-events-none"
                      style={{
                        boxShadow: "inset 0 0 20px rgba(0, 212, 255, 0.2)",
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  )}
                </div>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-xs mt-2 font-medium"
                  >
                    {errors.email}
                  </motion.p>
                )}
              </motion.div>

              {/* PASSWORD INPUT */}
              {!requires2FA && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <label className="block text-cyan-300 text-sm font-semibold mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <motion.input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 backdrop-blur border-2 transition-all duration-300 text-white placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      style={{
                        borderColor: isPasswordFocused ? "#00d4ff" : "rgba(100, 200, 255, 0.3)",
                        boxShadow: isPasswordFocused ? "0 0 20px rgba(0, 212, 255, 0.3)" : "none",
                      }}
                      placeholder="Enter your password"
                      whileFocus={{
                        scale: 1.02,
                      }}
                    />
                    {isPasswordFocused && (
                      <motion.div
                        className="absolute inset-0 rounded-lg pointer-events-none"
                        style={{
                          boxShadow: "inset 0 0 20px rgba(0, 212, 255, 0.2)",
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      />
                    )}
                  </div>
                  {errors.password && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-xs mt-2 font-medium"
                    >
                      {errors.password}
                    </motion.p>
                  )}
                </motion.div>
              )}

              {/* 2FA INPUT */}
              {requires2FA && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4"
                >
                  {/* 2FA Header */}
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mb-3">
                      <span className="text-2xl">🔐</span>
                    </div>
                    <h3 className="text-cyan-200 font-bold text-lg">2FA Verification</h3>
                    <p className="text-blue-300/60 text-xs mt-1">Open your authenticator app and enter the 6-digit code</p>
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={token2FA}
                    onChange={(e) => { setToken2FA(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                    className="w-full px-4 py-4 rounded-lg bg-white/5 backdrop-blur border-2 border-cyan-500/40 transition-all duration-300 text-white placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-center font-mono text-3xl tracking-[0.6em]"
                    placeholder="······"
                    maxLength={6}
                    autoFocus
                  />

                  {/* Back button */}
                  <button
                    type="button"
                    onClick={handleBack}
                    className="w-full mt-4 py-2 text-sm text-cyan-400/70 hover:text-cyan-300 transition-colors duration-200 flex items-center justify-center gap-1"
                  >
                    <span>←</span> Back to Login
                  </button>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="pt-4"
              >
                <QuantumButton
                  disabled={loading}
                  variant="primary"
                  size="lg"
                  className="w-full disabled:opacity-50"
                >
                  {loading ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="inline-block"
                    >
                      ⧳
                    </motion.span>
                  ) : requires2FA ? (
                    "Verify & Sign In"
                  ) : (
                    "Sign In"
                  )}
                </QuantumButton>
              </motion.div>

            </form>

            {/* FORGOT PASSWORD LINK - PLACED OUTSIDE FORM FOR BETTER UX */}
            {!requires2FA && (
              <motion.div
                className="text-right mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Link
                  to="/forgot-password"
                  className="text-cyan-400 text-xs font-semibold hover:text-cyan-300 transition hover:underline"
                >
                  Forgot your password?
                </Link>
              </motion.div>
            )}


            {/* DIVIDER */}
            <motion.div
              className="my-6 flex items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
              <span className="text-cyan-300/60 text-xs font-semibold">NEW USER?</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            </motion.div>

            {/* SIGNUP LINK */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-center"
            >
              <p className="text-white/60 text-sm mb-3">
                Don't have an account?
              </p>
              <Link
                to="/register"
                className="inline-block px-6 py-2 rounded-lg border-2 border-cyan-400/50 text-cyan-300 font-bold text-sm hover:border-cyan-300 hover:text-cyan-200 transition hover:bg-cyan-500/10"
              >
                Create Account
              </Link>
            </motion.div>
          </FutureCard>

          {/* FOOTER INFO */}
          <motion.p
            className="text-center text-white/40 text-xs mt-8 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Secure. Private. Professional Asset Management.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

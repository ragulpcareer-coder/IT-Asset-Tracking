import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import { validateEmail } from "../utils/validation";
import { QuantumBackground, FutureCard, QuantumButton } from "../components/FuturisticUI";
import "../modern.css";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });

  const validateForm = () => {
    const nextErrors = { email: "", password: "" };
    let valid = true;

    if (!email.trim()) {
      nextErrors.email = "Email is required";
      valid = false;
    } else if (!validateEmail(email.trim())) {
      nextErrors.email = "Please enter a valid email address";
      valid = false;
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required";
      valid = false;
    }

    setErrors(nextErrors);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    const fingerprint = {
      browser: navigator.userAgent,
      language: navigator.language,
      resolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    try {
      setLoading(true);
      const data = await login(email.trim(), password, "", fingerprint);

      if (data?.requires2FA) {
        const pending = { userId: data.userId, email: data.user?.email || email.trim() };
        sessionStorage.setItem("pending_2fa", JSON.stringify(pending));
        navigate("/verify-2fa", { state: pending });
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "AUTH_401") {
        setError("Invalid email or password.");
      } else if (data?.code === "AUTH_423") {
        setError(data.message || "Your account is temporarily locked due to failed attempts.");
      } else {
        setError(data?.message || "Sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-hidden relative bg-[#0a1128]">
      <QuantumBackground className="z-0" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black mb-3 bg-gradient-to-r from-[#00d4ff] via-[#6432ff] to-[#00d4ff] bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p className="text-cyan-300 text-sm font-medium">Sign in to continue to your dashboard</p>
          </div>

          <FutureCard accentColor="#00d4ff" fullWidth>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-cyan-300 text-sm font-semibold mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 backdrop-blur border-2 border-[rgba(100,200,255,0.3)] text-white placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="Enter your registered email"
                  autoComplete="email"
                />
                {errors.email && <p className="text-red-400 text-xs mt-2">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-cyan-300 text-sm font-semibold mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 backdrop-blur border-2 border-[rgba(100,200,255,0.3)] text-white placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                {errors.password && <p className="text-red-400 text-xs mt-2">{errors.password}</p>}
              </div>

              <QuantumButton type="submit" disabled={loading} variant="primary" size="lg" className="w-full disabled:opacity-50">
                {loading ? "Signing In..." : "Sign In"}
              </QuantumButton>
            </form>

            <div className="text-right mt-4">
              <Link to="/forgot-password" className="text-cyan-400 text-xs font-semibold hover:text-cyan-300 transition hover:underline">
                Forgot your password?
              </Link>
            </div>

            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
              <span className="text-cyan-300/60 text-xs font-semibold">NEW USER?</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            </div>

            <div className="text-center">
              <p className="text-white/60 text-sm mb-3">Don't have an account?</p>
              <Link
                to="/register"
                className="inline-block px-6 py-2 rounded-lg border-2 border-cyan-400/50 text-cyan-300 font-bold text-sm hover:border-cyan-300 hover:text-cyan-200 transition hover:bg-cyan-500/10"
              >
                Create Account
              </Link>
            </div>
          </FutureCard>

          <p className="text-center text-white/40 text-xs mt-8 font-medium">
            Secure. Private. Professional Asset Management.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

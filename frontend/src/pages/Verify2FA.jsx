import React, { useContext, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import { QuantumBackground, FutureCard, QuantumButton } from "../components/FuturisticUI";
import "../modern.css";

export default function Verify2FA() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verify2FA } = useContext(AuthContext);

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pending = useMemo(() => {
    const stateUser = location.state?.userId;
    const stored = sessionStorage.getItem("pending_2fa");
    if (stateUser) {
      const payload = { userId: location.state.userId, email: location.state.email || "" };
      sessionStorage.setItem("pending_2fa", JSON.stringify(payload));
      return payload;
    }
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (_) {
        return null;
      }
    }
    return null;
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!pending?.userId) {
      setError("Your sign-in session expired. Please login again.");
      return;
    }

    if (!/^\d{6}$/.test(token)) {
      setError("Enter a valid 6-digit verification code.");
      return;
    }

    try {
      setLoading(true);
      await verify2FA(pending.userId, token);
      sessionStorage.removeItem("pending_2fa");
      navigate("/dashboard");
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || "Invalid verification code. Please try again.");
      if (data?.code === "2FA_SECRET_CORRUPT") {
        sessionStorage.removeItem("pending_2fa");
      }
      setToken("");
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <FutureCard accentColor="#00d4ff" fullWidth>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-black text-cyan-200 mb-2">Verify Identity</h1>
              <p className="text-blue-300/80 text-sm">
                Enter the 6-digit code from your authenticator app
                {pending?.email ? ` for ${pending.email}` : ""}.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-cyan-300 text-sm font-semibold mb-2">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value.replace(/\D/g, "").slice(0, 6));
                    if (error) setError("");
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 backdrop-blur border-2 border-cyan-500/30 text-white text-center font-mono text-3xl tracking-[0.45em] focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              <QuantumButton type="submit" disabled={loading} variant="primary" size="lg" className="w-full disabled:opacity-50">
                {loading ? "Verifying..." : "Verify & Sign In"}
              </QuantumButton>
            </form>

            <div className="mt-5 text-center">
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 text-sm">
                Back to Login
              </Link>
            </div>
          </FutureCard>
        </motion.div>
      </div>
    </div>
  );
}

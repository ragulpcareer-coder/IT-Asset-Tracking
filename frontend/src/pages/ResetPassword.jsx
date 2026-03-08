import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../utils/axiosConfig";
import { Button, Input, Alert, PasswordStrengthMeter } from "../components/UI";
import { BrandLogo } from "../components/ProfessionalIcons";
import { Background3D, HolographicCard, TechGrid } from "../components/3DBackground";
import { animationVariants } from "../utils/animations";
import { getPasswordRequirements } from "../utils/validation";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  const passwordRequirements = getPasswordRequirements();

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError("Invalid or missing reset token.");
        setVerifying(false);
        return;
      }
      try {
        const { data } = await axios.get(`/auth/reset-password/${token}`);
        const payload = data?.data || data;
        setIsValid(true);
        setEmail(payload?.email || "");
      } catch (err) {
        setError(err.response?.data?.message || "This reset link is invalid or expired.");
      } finally {
        setVerifying(false);
      }
    };
    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await axios.post(`/auth/reset-password/${token}`, {
        password: formData.password
      });
      setMessage(data.message || "Password updated successfully.");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password. Please request a new link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden gradient-animated">
      <Background3D className="z-0" />
      <TechGrid className="z-1" />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-md"
          initial="hidden"
          animate="visible"
          variants={animationVariants.containerVariants}
        >
          <div className="text-center mb-10">
            <motion.div className="inline-block mb-6" variants={animationVariants.itemVariants}>
              <BrandLogo variant="icon" size="lg" />
            </motion.div>
            <motion.h1
              className="text-4xl font-black bg-gradient-to-r from-teal-300 via-blue-300 to-teal-400 bg-clip-text text-transparent mb-2"
              variants={animationVariants.itemVariants}
            >
              Reset Password
            </motion.h1>
            <motion.p className="text-blue-100 font-light" variants={animationVariants.itemVariants}>
              Set a new password for {email || "your account"}
            </motion.p>
          </div>

          <motion.div className="card-3d corner-glow" variants={animationVariants.itemVariants}>
            <HolographicCard className="rounded-3xl p-8">
              <AnimatePresence mode="wait">
                {verifying ? (
                  <motion.div
                    key="verifying"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center py-10"
                  >
                    <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-cyan-200 animate-pulse font-mono text-xs">VERIFYING RESET TOKEN...</p>
                  </motion.div>
                ) : message ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50 shadow-lg shadow-green-500/20">
                      <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Password Updated</h3>
                    <p className="text-blue-200 text-sm mb-6 leading-relaxed">{message}</p>
                    <p className="text-xs text-cyan-400 animate-pulse font-bold">REDIRECTING TO LOGIN...</p>
                  </motion.div>
                ) : !isValid ? (
                  <motion.div
                    key="invalid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-6"
                  >
                    <Alert type="error" message={error} />
                    <Link to="/forgot-password">
                      <Button variant="outline" className="w-full mt-6 h-12 border-blue-500/30 text-blue-300">
                        Request New Reset Link
                      </Button>
                    </Link>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onSubmit={handleSubmit}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-blue-100">New Password</label>
                      <Input
                        type="password"
                        placeholder="Enter a strong password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        className="bg-black/40 border-blue-500/40 text-white h-12"
                      />
                      <PasswordStrengthMeter
                        password={formData.password}
                        requirements={passwordRequirements}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-blue-100">Confirm Password</label>
                      <Input
                        type="password"
                        placeholder="Re-enter your password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                        className="bg-black/40 border-blue-500/40 text-white h-12"
                      />
                    </div>

                    {error && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                        <Alert type="error" message={error} onClose={() => setError("")} />
                      </motion.div>
                    )}

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-green-600 font-bold"
                      loading={loading}
                      disabled={loading || formData.password.length < 8}
                    >
                      {loading ? "Updating..." : "Update Password"}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </HolographicCard>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

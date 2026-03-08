import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../utils/axiosConfig";
import { Button, Input, Alert } from "../components/UI";
import { BrandLogo } from "../components/ProfessionalIcons";
import { Background3D, HolographicCard, TechGrid } from "../components/3DBackground";
import { animationVariants } from "../utils/animations";
import { validateEmail } from "../utils/validation";

const COOLDOWN_SECONDS = 30;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const remainingCooldown = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading || remainingCooldown > 0) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email is required");
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setEmailError("");

    try {
      const { data } = await axios.post("/auth/forgot-password", { email: trimmedEmail });
      setMessage(data.message || "If an account exists, a reset link has been sent.");
      setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || "Unable to send reset link right now. Please try again.");
      if (err.response?.status >= 500) {
        setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);
      }
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
              Account Recovery
            </motion.h1>
            <motion.p className="text-blue-100 font-light" variants={animationVariants.itemVariants}>
              Enter your registered email to receive a password reset link.
            </motion.p>
          </div>

          <motion.div className="card-3d corner-glow" variants={animationVariants.itemVariants}>
            <HolographicCard className="rounded-3xl p-8">
              <AnimatePresence mode="wait">
                {message ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/50 shadow-lg shadow-blue-500/20">
                      <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Email Sent!</h3>
                    <p className="text-blue-200 text-sm mb-8 leading-relaxed">
                      A password reset link has been sent to your email address. Please check your inbox and spam folder.
                    </p>
                    <Link to="/login" className="block">
                      <Button variant="primary" className="w-full h-12">
                        Return to Login
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
                      <label className="block text-sm font-semibold text-blue-100">
                        Official Email Address
                      </label>
                      <Input
                        type="email"
                        placeholder="Enter your registered email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (emailError) setEmailError("");
                        }}
                        required
                        className="bg-black/40 border-blue-500/30 text-white h-12"
                      />
                      {emailError && <p className="text-red-400 text-xs">{emailError}</p>}
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
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-500 font-bold"
                      loading={loading}
                      disabled={loading || remainingCooldown > 0}
                    >
                      {loading ? "Sending..." : remainingCooldown > 0 ? `Try again in ${remainingCooldown}s` : "Send Reset Link"}
                    </Button>

                    <div className="text-center pt-2">
                      <Link to="/login" className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-all flex items-center justify-center gap-2">
                        Back to Login
                      </Link>
                    </div>
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

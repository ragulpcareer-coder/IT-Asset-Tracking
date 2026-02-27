import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../utils/axiosConfig";
import { Button, Input, Alert } from "../components/UI";
import { BrandLogo } from "../components/ProfessionalIcons";
import { Background3D, HolographicCard, TechGrid } from "../components/3DBackground";
import { animationVariants } from "../utils/animations";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        // Anti-multi-click guard
        if (loading) return;

        console.log("[Recovery] Initiating password reset for:", email);
        setLoading(true);
        setError("");
        setMessage("");

        try {
            const { data } = await axios.post("/auth/forgot-password", { email: email.trim() });
            console.log("[Recovery] Success response received:", data);
            setMessage(data.message || "If the account exists, a recovery link has been dispatched.");
        } catch (err) {
            console.error("[Recovery] Failed to dispatch recovery link:", err);
            const errorMsg = err.response?.data?.message || "Internal SOC Engine Failure. Please contact administrator.";
            setError(errorMsg);
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
                            Enter your registered email to receive a secure restoration link
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
                                        <h3 className="text-2xl font-bold text-white mb-3">Transmission Successful</h3>
                                        <p className="text-blue-200 text-sm mb-8 leading-relaxed">
                                            A secure recovery packet has been dispatched to your registry. Please verify your inbox and spam folder.
                                        </p>
                                        <Link to="/login" className="block">
                                            <Button variant="primary" className="w-full h-12">
                                                Return to Sign In Terminal
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
                                                placeholder="Enter your system email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                className="bg-black/40 border-blue-500/30 text-white h-12"
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
                                            className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-500 font-bold uppercase tracking-wider"
                                            loading={loading}
                                            disabled={loading || !email}
                                        >
                                            {loading ? "Decrypting..." : "Request Recovery Link"}
                                        </Button>

                                        <div className="text-center pt-2">
                                            <Link to="/login" className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-all flex items-center justify-center gap-2">
                                                <span>←</span> ABORT AND RETURN TO LOGIN
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

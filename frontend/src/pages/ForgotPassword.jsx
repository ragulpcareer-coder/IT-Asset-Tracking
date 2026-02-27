import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
        e.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");

        try {
            const { data } = await axios.post("/auth/forgot-password", { email });
            setMessage(data.message);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to dispatch recovery link. Please try again.");
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
                            Secure credential restoration protocol
                        </motion.p>
                    </div>

                    <motion.div className="card-3d corner-glow" variants={animationVariants.itemVariants}>
                        <HolographicCard className="rounded-3xl p-8">
                            {message ? (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/50">
                                        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">Transmission Sent</h3>
                                    <p className="text-blue-200 text-sm mb-8 leading-relaxed">
                                        {message}
                                    </p>
                                    <Link to="/login" className="block">
                                        <Button variant="outline" className="w-full">
                                            Return to Sign In
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-blue-100">
                                            Registered Email
                                        </label>
                                        <Input
                                            type="email"
                                            placeholder="Enter your official email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="bg-gray-900/80 border-blue-500/30 text-white"
                                        />
                                    </div>

                                    {error && <Alert type="error" message={error} onClose={() => setError("")} />}

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="lg"
                                        className="w-full bg-gradient-to-r from-blue-600 to-teal-500"
                                        loading={loading}
                                        disabled={loading}
                                    >
                                        Send Recovery Link
                                    </Button>

                                    <div className="text-center pt-2">
                                        <Link to="/login" className="text-sm font-bold text-blue-300 hover:text-blue-200 transition">
                                            ← Back to Secure Login
                                        </Link>
                                    </div>
                                </form>
                            )}
                        </HolographicCard>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}

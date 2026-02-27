import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
                setError("Invalid or missing security signature.");
                setVerifying(false);
                return;
            }
            try {
                const { data } = await axios.get(`/auth/reset-password/${token}`);
                setIsValid(true);
                setEmail(data.email);
            } catch (err) {
                setError(err.response?.data?.message || "This link has expired or reached maximum rotation limit.");
            } finally {
                setVerifying(false);
            }
        };
        verifyToken();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError("Credentials do not match.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const { data } = await axios.post(`/auth/reset-password/${token}`, {
                password: formData.password
            });
            setMessage(data.message);
            setTimeout(() => navigate("/login"), 3000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to rotate credentials. Try requesting a new link.");
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
                            Credential Rotation
                        </motion.h1>
                        <motion.p className="text-blue-100 font-light" variants={animationVariants.itemVariants}>
                            Establish new secure access keys for {email || 'your account'}
                        </motion.p>
                    </div>

                    <motion.div className="card-3d corner-glow" variants={animationVariants.itemVariants}>
                        <HolographicCard className="rounded-3xl p-8">
                            {verifying ? (
                                <div className="flex flex-col items-center py-10">
                                    <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                    <p className="text-blue-200 animate-pulse">Verifying Security Signature...</p>
                                </div>
                            ) : message ? (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50">
                                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">Sync Successful</h3>
                                    <p className="text-blue-200 text-sm mb-8">
                                        {message}
                                    </p>
                                    <p className="text-xs text-blue-400 animate-pulse">Redirecting to Terminal Access...</p>
                                </div>
                            ) : !isValid ? (
                                <div className="text-center py-6">
                                    <Alert type="error" message={error} />
                                    <Link to="/forgot-password">
                                        <Button variant="outline" className="w-full mt-6">Request New Link</Button>
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-blue-100">New Secure Password</label>
                                        <Input
                                            type="password"
                                            placeholder="Minimum 12 characters"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            className="bg-gray-900/80 border-blue-500/30"
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
                                            placeholder="Repeat credentials"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            required
                                            className="bg-gray-900/80 border-blue-500/30"
                                        />
                                    </div>

                                    {error && <Alert type="error" message={error} onClose={() => setError("")} />}

                                    <Button
                                        type="submit"
                                        variant="success"
                                        size="lg"
                                        className="w-full bg-gradient-to-r from-green-600 to-teal-600"
                                        loading={loading}
                                        disabled={loading || formData.password.length < 12}
                                    >
                                        Commit New Password
                                    </Button>
                                </form>
                            )}
                        </HolographicCard>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}

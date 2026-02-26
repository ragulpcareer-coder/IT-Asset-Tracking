import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Input, PasswordStrengthMeter, Alert } from "../components/UI";
import { ProfessionalIcon, BrandLogo } from "../components/ProfessionalIcons";
import { Background3D, HolographicCard, FloatingElement, GlowingOrb, TechGrid } from "../components/3DBackground";
import { validateEmail, getPasswordRequirements } from "../utils/validation";
import { animationVariants } from "../utils/animations";
import { theme } from "../config/theme";
import { brandIdentity } from "../config/brandIdentity";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "User",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [success, setSuccess] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = { name: "", email: "", password: "", confirmPassword: "" };
    let isValid = true;

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
      isValid = false;
    }

    if (!formData.email || !validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
      isValid = false;
    }

    if (!formData.password || formData.password.length < 12) {
      newErrors.password = "Password must be at least 12 characters (uppercase, lowercase, number, symbol required)";
      isValid = false;
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      isValid = false;
    }

    if (!agreeTerms) {
      setError("You must agree to the terms and conditions");
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    const newErrors = { ...errors };
    let isValid = true;

    if (activeStep === 1) {
      if (!formData.name || formData.name.trim().length < 2) {
        newErrors.name = "Name must be at least 2 characters";
        isValid = false;
      } else newErrors.name = "";

      if (!formData.email || !validateEmail(formData.email)) {
        newErrors.email = "Please enter a valid email address";
        isValid = false;
      } else newErrors.email = "";

      setErrors(newErrors);
      if (isValid) setActiveStep(2);
    } else if (activeStep === 2) {
      if (!formData.password || formData.password.length < 12) {
        newErrors.password = "Password must be at least 12 characters";
        isValid = false;
      } else newErrors.password = "";

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
        isValid = false;
      } else newErrors.confirmPassword = "";

      setErrors(newErrors);
      if (isValid) setActiveStep(3);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submitLock = React.useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current) return;
    setError("");

    if (!validateForm()) return;

    try {
      submitLock.current = true;
      setLoading(true);
      const data = await register(
        formData.name,
        formData.email,
        formData.password,
        formData.role
      );

      if (data.accessToken) {
        navigate("/");
      } else {
        setSuccess(data.message || "Registration request sent! Please wait for admin approval.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
      submitLock.current = false;
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = getPasswordRequirements();

  return (
    <div className="min-h-screen relative overflow-hidden gradient-animated">
      {/* 3D Particle Background */}
      <Background3D className="z-0" />

      {/* Tech Grid Overlay */}
      <TechGrid className="z-1" />

      {/* Animated Floating Orbits */}
      <motion.div
        className="absolute top-32 right-10 w-32 h-32 opacity-20 z-1"
        animate={{
          y: [0, 40, -30, 0],
          x: [0, 25, -20, 0],
          rotate: [360, 180, 0],
        }}
        transition={{ duration: 18, repeat: Infinity }}
      >
        <GlowingOrb color="#00897B" size="w-32 h-32" />
      </motion.div>

      <motion.div
        className="absolute bottom-32 left-10 w-28 h-28 opacity-15 z-1"
        animate={{
          y: [0, -35, 25, 0],
          x: [0, -30, 20, 0],
          rotate: [0, 180, 360],
        }}
        transition={{ duration: 15, repeat: Infinity, delay: 3 }}
      >
        <GlowingOrb color="#1B5E9B" size="w-28 h-28" />
      </motion.div>

      {/* Main Content Container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
        <motion.div
          className="w-full max-w-2xl"
          initial="hidden"
          animate="visible"
          variants={animationVariants.containerVariants}
        >
          {/* Header Section */}
          <motion.div
            className="text-center mb-10"
            variants={animationVariants.itemVariants}
          >
            <FloatingElement delay={0} duration={4}>
              <motion.div
                className="inline-block mb-6"
                whileHover={{ scale: 1.1, rotateZ: -10 }}
                whileTap={{ scale: 0.95 }}
                animate={{ rotateY: [0, -360] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <BrandLogo variant="icon" size="lg" />
              </motion.div>
            </FloatingElement>

            <motion.h1
              className="text-5xl font-black bg-gradient-to-r from-teal-300 via-blue-300 to-teal-400 bg-clip-text text-transparent mb-3"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Join the Team
            </motion.h1>

            <motion.p
              className="text-blue-100 text-lg font-light"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Create your account in minutes
            </motion.p>
          </motion.div>

          {/* Step Indicators */}
          <motion.div
            className="flex justify-between gap-4 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {[1, 2, 3].map((step) => (
              <motion.div
                key={step}
                className="flex-1"
                whileHover={{ scale: 1.05 }}
              >
                <div className={`h-1 rounded-full transition-all duration-300 ${activeStep >= step
                  ? "bg-gradient-to-r from-blue-500 to-teal-500"
                  : "bg-blue-900/30"
                  }`} />
                <p className="text-xs text-blue-200 mt-2 text-center font-semibold">
                  {step === 1 ? "Personal" : step === 2 ? "Security" : "Confirm"}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Holographic Registration Card */}
          <motion.div
            variants={animationVariants.itemVariants}
            className="card-3d corner-glow"
          >
            <HolographicCard className="rounded-3xl p-8 space-y-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent mb-2">
                  Create Account
                </h2>
                <p className="text-blue-200 text-sm">
                  Step {activeStep} of 3
                </p>
              </motion.div>
              {error && (
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: "spring" }}
                >
                  <Alert
                    type="error"
                    title="Registration Error"
                    message={error}
                    onClose={() => setError("")}
                  />
                </motion.div>
              )}

              {success ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-10 space-y-6"
                >
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/50">
                    <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Request Received</h3>
                    <p className="text-blue-100 px-4">
                      {success}
                    </p>
                  </div>
                  <Link to="/login">
                    <Button variant="primary" className="mt-4 px-8">
                      Back to Login
                    </Button>
                  </Link>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Step 1: Personal Info */}
                  {activeStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                    >
                      <div>
                        <label className="block text-sm font-semibold text-blue-100 mb-2">
                          Full Name
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-teal-600 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition duration-300"></div>
                          <Input
                            placeholder="John Doe"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            error={errors.name}
                            required
                            className="relative bg-gray-900/80 text-white placeholder-gray-500 border border-blue-500/30 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-800 caret-white"
                          />
                        </div>
                        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-blue-100 mb-2">
                          Email Address
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-teal-600 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition duration-300"></div>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            error={errors.email}
                            required
                            className="relative bg-gray-900/80 text-white placeholder-gray-500 border border-blue-500/30 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-800 caret-white"
                          />
                        </div>
                        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                      </div>

                    </motion.div>
                  )}

                  {/* Step 2: Security Setup */}
                  {activeStep === 2 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                    >
                      <div>
                        <label className="block text-sm font-semibold text-blue-100 mb-2">
                          Password
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-teal-600 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition duration-300"></div>
                          <Input
                            type="password"
                            placeholder="Create a strong password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            error={errors.password}
                            required
                            className="relative bg-gray-900/80 text-white placeholder-gray-500 border border-blue-500/30 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-800 caret-white"
                          />
                        </div>
                        {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                        {formData.password && (
                          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <PasswordStrengthMeter
                              password={formData.password}
                              requirements={passwordRequirements}
                            />
                          </motion.div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-blue-100 mb-2">
                          Confirm Password
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-teal-600 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition duration-300"></div>
                          <Input
                            type="password"
                            placeholder="Confirm your password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            error={errors.confirmPassword}
                            required
                            className="relative bg-gray-900/80 text-white placeholder-gray-500 border border-blue-500/30 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-800 caret-white"
                          />
                        </div>
                        {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Confirmation */}
                  {activeStep === 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                    >
                      <div className="bg-gradient-to-r from-blue-900/30 to-teal-900/30 p-6 rounded-lg border border-blue-500/20 backdrop-blur-md">
                        <h3 className="text-lg font-bold text-blue-100 mb-4">Verify Your Information</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-blue-500/10">
                            <span className="text-blue-200">Name:</span>
                            <span className="text-white font-semibold">{formData.name}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-blue-500/10">
                            <span className="text-blue-200">Email:</span>
                            <span className="text-white font-semibold">{formData.email}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-blue-200">Role:</span>
                            <span className="text-white font-semibold">User (assigned by admin)</span>
                          </div>
                        </div>
                      </div>

                      <motion.div
                        className="p-4 rounded-lg border border-teal-500/30 bg-teal-900/20 backdrop-blur-md"
                        whileHover={{ scale: 1.02 }}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={agreeTerms}
                            onChange={(e) => setAgreeTerms(e.target.checked)}
                            className="w-5 h-5 mt-0.5 rounded border-teal-500 accent-teal-500"
                          />
                          <span className="text-sm text-teal-100">
                            I agree to the{" "}
                            <a href="#" className="font-bold text-teal-300 hover:text-teal-200">
                              Terms of Service
                            </a>{" "}
                            and{" "}
                            <a href="#" className="font-bold text-teal-300 hover:text-teal-200">
                              Privacy Policy
                            </a>
                          </span>
                        </label>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex gap-3 pt-4">
                    {activeStep > 1 && (
                      <motion.div
                        className="flex-1"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={() => setActiveStep(activeStep - 1)}
                          className="w-full"
                        >
                          Previous
                        </Button>
                      </motion.div>
                    )}

                    {activeStep < 3 ? (
                      <motion.div
                        className={activeStep === 1 ? "w-full" : "flex-1"}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          type="button"
                          variant="primary"
                          size="lg"
                          onClick={handleNext}
                          className="w-full bg-gradient-to-r from-blue-600 via-teal-500 to-blue-600"
                        >
                          Next
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        className="flex-1"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          type="submit"
                          variant="success"
                          size="lg"
                          loading={loading}
                          disabled={loading || !agreeTerms}
                          className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:shadow-2xl hover:shadow-green-500/50"
                        >
                          {loading ? "Creating..." : "Create Account"}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </form>
              )}
            </HolographicCard>
          </motion.div>

          {/* Sign In Link */}
          <motion.div
            className="mt-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <p className="text-blue-200">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-bold text-transparent bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text hover:from-blue-200 hover:to-teal-200 transition"
              >
                Sign in here
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </div >
    </div >
  );
}

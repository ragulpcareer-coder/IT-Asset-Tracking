import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Input, Alert } from "../components/UI";
import { ProfessionalIcon, BrandLogo } from "../components/ProfessionalIcons";
import { validateEmail } from "../utils/validation";
import { animationVariants } from "../utils/animations";
import { theme } from "../config/theme";
import { brandIdentity, professionalColors } from "../config/brandIdentity";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = { email: "", password: "" };
    let isValid = true;

    if (!email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    try {
      setLoading(true);
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-600 to-teal-600 flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(to bottom right, ${theme.colors.primary[600]}, ${theme.colors.primary[500]}, ${theme.colors.secondary[600]})`
      }}
    >
      {/* Animated background elements */}
      <motion.div
        className="absolute top-20 left-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        animate={{ y: [0, 50, 0], x: [0, 30, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
        style={{ backgroundColor: theme.colors.primary[400] }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        animate={{ y: [0, -50, 0], x: [0, -30, 0] }}
        transition={{ duration: 8, repeat: Infinity, delay: 1 }}
        style={{ backgroundColor: theme.colors.secondary[400] }}
      />

      <motion.div
        className="w-full max-w-md relative z-10"
        initial="hidden"
        animate="visible"
        variants={animationVariants.containerVariants}
      >
        {/* Logo/Header Section */}
        <motion.div
          className="text-center mb-8"
          variants={animationVariants.itemVariants}
        >
          <motion.div
            className="inline-block mb-4"
            whileHover={{ scale: 1.05, rotate: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <BrandLogo variant="main" size="lg" />
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-2">{brandIdentity.name}</h1>
          <p className="text-blue-100">{brandIdentity.tagline}</p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          className="bg-white backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden"
          variants={animationVariants.itemVariants}
        >
          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Welcome Back</h2>
              <p className="text-gray-600 text-sm mt-1">
                Login to manage your IT assets securely
              </p>
            </div>

            {error && (
              <Alert
                type="error"
                title="Login Failed"
                message={error}
                onClose={() => setError("")}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <ProfessionalIcon name="email" size={16} />
                    Email Address
                  </div>
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  error={errors.email}
                  required
                  className="!pl-10"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <ProfessionalIcon name="lock" size={16} />
                    Password
                  </div>
                </label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  required
                  className="!pl-10"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              <motion.div
                className="flex items-center justify-between text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-gray-700">Remember me</span>
                </label>
                <a
                  href="#"
                  className="text-blue-600 hover:text-blue-700 font-semibold transition"
                >
                  Forgot password?
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </motion.div>
            </form>

            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </motion.div>

            <motion.div
              className="flex gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <button className="flex-1 flex items-center justify-center gap-2 p-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700">
                <ProfessionalIcon name="user" size={18} />
                <span className="hidden sm:inline">Demo</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 p-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700">
                <ProfessionalIcon name="link" size={18} />
                <span className="hidden sm:inline">SSO</span>
              </button>
            </motion.div>
          </div>

          <motion.div
            className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-4 flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <span className="text-gray-700">Don't have an account?</span>
            <Link
              to="/register"
              className="font-bold text-blue-600 hover:text-blue-700 transition"
            >
              Sign Up
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

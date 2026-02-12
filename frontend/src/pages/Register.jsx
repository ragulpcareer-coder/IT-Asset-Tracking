import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Input, PasswordStrengthMeter, Alert } from "../components/UI";
import { ProfessionalIcon, BrandLogo } from "../components/ProfessionalIcons";
import { validateEmail, getPasswordRequirements } from "../utils/validation";
import { animationVariants } from "../utils/animations";
import { theme } from "../config/theme";
import { brandIdentity, professionalColors } from "../config/brandIdentity";

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
  const [agreeTerms, setAgreeTerms] = useState(false);
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

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    try {
      setLoading(true);
      await register(
        formData.name,
        formData.email,
        formData.password,
        formData.role
      );
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = getPasswordRequirements();

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden py-12"
      style={{
        background: `linear-gradient(to bottom right, ${theme.colors.primary[600]}, ${theme.colors.primary[500]}, ${theme.colors.secondary[600]})`
      }}
    >
      {/* Animated background elements */}
      <motion.div
        className="absolute top-20 right-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        animate={{ y: [0, 50, 0], x: [0, 30, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
        style={{ backgroundColor: theme.colors.secondary[400] }}
      />
      <motion.div
        className="absolute bottom-20 left-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        animate={{ y: [0, -50, 0], x: [0, -30, 0] }}
        transition={{ duration: 8, repeat: Infinity, delay: 1 }}
        style={{ backgroundColor: theme.colors.primary[400] }}
      />

      <motion.div
        className="w-full max-w-lg relative z-10"
        initial="hidden"
        animate="visible"
        variants={animationVariants.containerVariants}
      >
        {/* Logo/Header Section */}
        <motion.div
          className="text-center mb-6"
          variants={animationVariants.itemVariants}
        >
          <motion.div
            className="inline-block mb-4"
            whileHover={{ scale: 1.05, rotate: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <BrandLogo variant="main" size="lg" />
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-2">Join {brandIdentity.name}</h1>
          <p className="text-blue-100">Create a secure account today</p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          className="bg-white backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden"
          variants={animationVariants.itemVariants}
        >
          <div className="p-8 space-y-6">
            {error && (
              <Alert
                type="error"
                title="Registration Error"
                message={error}
                onClose={() => setError("")}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <ProfessionalIcon name="user" size={16} />
                    Full Name
                  </div>
                </label>
                <Input
                  placeholder="John Doe"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={errors.name}
                  required
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <ProfessionalIcon name="email" size={16} />
                    Email Address
                  </div>
                </label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  required
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <ProfessionalIcon name="lock" size={16} />
                    Password
                  </div>
                </label>
                <Input
                  type="password"
                  placeholder="Create a strong password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  required
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                {formData.password && (
                  <PasswordStrengthMeter
                    password={formData.password}
                    requirements={passwordRequirements}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <ProfessionalIcon name="check" size={16} />
                    Confirm Password
                  </div>
                </label>
                <Input
                  type="password"
                  placeholder="Confirm your password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={errors.confirmPassword}
                  required
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <ProfessionalIcon name="userCheck" size={16} />
                    Role
                  </div>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none bg-white transition"
                  style={{ 
                    focusBorderColor: theme.colors.primary[500]
                  }}
                >
                  <option value="User">Regular User</option>
                  <option value="Admin">Administrator</option>
                </select>
                <p className="text-xs text-gray-500 mt-1.5">
                  Select your role in the organization
                </p>
              </div>

              <motion.div
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: `${theme.colors.primary[50]}`,
                  borderColor: theme.colors.primary[200]
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the{" "}
                    <a href="#" className="font-semibold hover:underline" style={{ color: theme.colors.primary[600] }}>
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="font-semibold hover:underline" style={{ color: theme.colors.primary[600] }}>
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  disabled={loading || !agreeTerms}
                  className="w-full"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </motion.div>
            </form>
          </div>

          <motion.div
            className="px-8 py-4 flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(to right, ${theme.colors.primary[50]}, ${theme.colors.secondary[50]})`
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <span className="text-gray-700">Already have an account?</span>
            <Link
              to="/login"
              className="font-bold transition"
              style={{ color: theme.colors.primary[600] }}
            >
              Sign In
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

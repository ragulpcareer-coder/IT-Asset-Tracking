import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import { Alert, Button, Input, PasswordStrengthMeter } from "../components/UI";
import AuthShell from "../components/AuthShell";
import {
  validateConfirmPasswordField,
  validateEmailField,
  validatePasswordField,
} from "../utils/formValidation";
import useDraftState from "../hooks/useDraftState";

const INITIAL_FORM_DATA = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const STEP_COPY = {
  1: {
    title: "Personal Details",
    description: "Start with the basics so we can create your account.",
  },
  2: {
    title: "Security Setup",
    description: "Choose a strong password that meets the project security policy.",
  },
  3: {
    title: "Review & Submit",
    description: "Confirm your details before creating your account.",
  },
};

const getNameError = (value) => {
  if (!String(value || "").trim()) return "Full name is required.";
  if (String(value).trim().length < 3) return "Full name must be at least 3 characters.";
  return "";
};

export default function Register() {
  const [formData, setFormData, clearDraft] = useDraftState("register-form-draft", INITIAL_FORM_DATA);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const setFieldError = (field, value) => {
    setErrors((prev) => ({ ...prev, [field]: value }));
  };

  const validateStepOne = () => {
    const nextErrors = {
      ...errors,
      name: getNameError(formData.name),
      email: validateEmailField(formData.email, "Email"),
    };

    setErrors(nextErrors);
    return !nextErrors.name && !nextErrors.email;
  };

  const validateStepTwo = () => {
    const nextErrors = {
      ...errors,
      password: validatePasswordField(formData.password),
      confirmPassword: validateConfirmPasswordField(formData.confirmPassword, formData.password),
    };

    setErrors(nextErrors);
    return !nextErrors.password && !nextErrors.confirmPassword;
  };

  const validateAll = () => {
    const personalValid = !getNameError(formData.name) && !validateEmailField(formData.email, "Email");
    const securityValid =
      !validatePasswordField(formData.password) &&
      !validateConfirmPasswordField(formData.confirmPassword, formData.password);

    const nextErrors = {
      name: getNameError(formData.name),
      email: validateEmailField(formData.email, "Email"),
      password: validatePasswordField(formData.password),
      confirmPassword: validateConfirmPasswordField(formData.confirmPassword, formData.password),
    };

    setErrors(nextErrors);

    if (!agreeTerms) {
      setError("You must agree to the terms and privacy policy before continuing.");
      return false;
    }

    return personalValid && securityValid;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");

    if (name === "name") {
      setFieldError("name", value ? getNameError(value) : "");
      return;
    }

    if (name === "email") {
      setFieldError("email", value ? validateEmailField(value, "Email") : "");
      return;
    }

    if (name === "password") {
      setErrors((prev) => ({
        ...prev,
        password: value ? validatePasswordField(value) : "",
        confirmPassword: formData.confirmPassword
          ? validateConfirmPasswordField(formData.confirmPassword, value)
          : prev.confirmPassword,
      }));
      return;
    }

    if (name === "confirmPassword") {
      setFieldError(
        "confirmPassword",
        value ? validateConfirmPasswordField(value, formData.password) : ""
      );
    }
  };

  const handleNext = async () => {
    setError("");

    if (activeStep === 1) {
      if (!validateStepOne()) return;

      try {
        setCheckingEmail(true);
        const { data } = await axios.post("/auth/check-email", { email: formData.email.trim() });
        if (!data?.available) {
          setFieldError("email", "Email already exists. Please use another email.");
          return;
        }
        setActiveStep(2);
      } catch (err) {
        setFieldError(
          "email",
          err.userFacingMessage || err.response?.data?.message || "Unable to validate email right now. Please try again."
        );
      } finally {
        setCheckingEmail(false);
      }
      return;
    }

    if (activeStep === 2 && validateStepTwo()) {
      setActiveStep(3);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    if (!validateAll()) return;

    try {
      setLoading(true);
      await register(formData.name.trim(), formData.email.trim(), formData.password);
      clearDraft();
      setSuccess("Account created successfully. Taking you to your dashboard...");
      redirectTimerRef.current = setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setError(err.userFacingMessage || err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentStep = STEP_COPY[activeStep];

  return (
    <AuthShell
      title="Create Your Account"
      subtitle="Register with the same secure, consistent interface used across every access flow in the platform."
      badge="Secure Enrollment"
      maxWidth="max-w-2xl"
      footer={
        <div className="space-y-3">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-sky-300 hover:text-sky-200">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-slate-500">New accounts start with standard access; an administrator can grant additional roles later.</p>
        </div>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((step) => {
          const isActive = activeStep === step;
          const isComplete = activeStep > step;
          return (
            <div
              key={step}
              className={`rounded-2xl border px-4 py-3 transition ${
                isActive
                  ? "border-sky-400/50 bg-sky-400/10"
                  : isComplete
                    ? "border-emerald-400/35 bg-emerald-400/10"
                    : "border-white/10 bg-white/5"
              }`}
            >
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Step {step}</div>
              <div className="text-sm font-semibold text-white">
                {step === 1 ? "Profile" : step === 2 ? "Security" : "Review"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
        <div className="text-sm font-semibold text-white">{currentStep.title}</div>
        <p className="mt-1 text-sm text-slate-400">{currentStep.description}</p>
      </div>

      {error ? <Alert type="error" message={error} onClose={() => setError("")} className="mb-5" /> : null}

      {success ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-2xl text-emerald-200">
            OK
          </div>
          <Alert type="success" title="Registration Submitted" message={success} />
          <p className="text-sm text-slate-400">Redirecting to sign in...</p>
          <Link to="/login" className="btn btn-primary w-full sm:w-auto">
            Back to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <AnimatePresence mode="wait">
            {activeStep === 1 ? (
              <motion.div
                key="register-step-1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <Input
                  id="register-name"
                  label="Full Name"
                  name="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={(event) => setFieldError("name", getNameError(event.target.value))}
                  error={errors.name}
                  required
                />

                <Input
                  id="register-email"
                  label="Work Email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={(event) => setFieldError("email", validateEmailField(event.target.value, "Email"))}
                  error={errors.email}
                  autoComplete="email"
                  required
                />
              </motion.div>
            ) : null}

            {activeStep === 2 ? (
              <motion.div
                key="register-step-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <Input
                  id="register-password"
                  label="Password"
                  name="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={(event) => setFieldError("password", validatePasswordField(event.target.value))}
                  error={errors.password}
                  autoComplete="new-password"
                  required
                />

                {formData.password ? <PasswordStrengthMeter password={formData.password} /> : null}

                <Input
                  id="register-confirm-password"
                  label="Confirm Password"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={(event) =>
                    setFieldError(
                      "confirmPassword",
                      validateConfirmPasswordField(event.target.value, formData.password)
                    )
                  }
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                  required
                />
              </motion.div>
            ) : null}

            {activeStep === 3 ? (
              <motion.div
                key="register-step-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="text-base font-semibold text-white">Review your registration</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex flex-col gap-1 border-b border-white/5 pb-3 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="text-slate-400">Full Name</dt>
                      <dd className="font-semibold text-white">{formData.name || "-"}</dd>
                    </div>
                    <div className="flex flex-col gap-1 border-b border-white/5 pb-3 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="text-slate-400">Email</dt>
                      <dd className="font-semibold text-white break-all">{formData.email || "-"}</dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="text-slate-400">Access Level</dt>
                      <dd className="font-semibold text-white">Pending administrator assignment</dd>
                    </div>
                  </dl>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(event) => {
                      setAgreeTerms(event.target.checked);
                      if (error) setError("");
                    }}
                    className="mt-1 h-4 w-4 rounded border border-white/20 bg-slate-950/60 text-sky-400 focus:ring-sky-400"
                  />
                  <span>
                    I agree to the{" "}
                    <a href="/terms-of-service" className="font-semibold text-sky-300 hover:text-sky-200">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy-policy" className="font-semibold text-sky-300 hover:text-sky-200">
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-between">
            <div>
              {activeStep > 1 ? (
                <Button type="button" variant="ghost" size="lg" className="w-full sm:w-auto" onClick={() => setActiveStep((prev) => prev - 1)}>
                  Back
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              {activeStep < 3 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={handleNext}
                  loading={checkingEmail}
                  disabled={checkingEmail}
                >
                  {checkingEmail ? "Checking..." : "Continue"}
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto"
                  loading={loading}
                  disabled={loading || !agreeTerms}
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              )}
            </div>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

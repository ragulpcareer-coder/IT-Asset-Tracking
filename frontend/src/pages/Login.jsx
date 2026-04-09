import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Alert, Button, Input } from "../components/UI";
import AuthShell from "../components/AuthShell";
import { validateEmailField, validateRequired } from "../utils/formValidation";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });

  const validateField = (name, value) => {
    if (name === "email") return validateEmailField(value, "Email");
    if (name === "password") return validateRequired(value, "Password");
    return "";
  };

  const validateForm = () => {
    const nextErrors = {
      email: validateField("email", email),
      password: validateField("password", password),
    };
    setErrors(nextErrors);
    return !nextErrors.email && !nextErrors.password;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!validateForm()) return;

    const fingerprint = {
      browser: navigator.userAgent,
      language: navigator.language,
      resolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    try {
      setLoading(true);
      const data = await login(email.trim(), password, "", fingerprint);

      if (data?.requires2FA) {
        const pending = { userId: data.userId, email: data.user?.email || email.trim() };
        sessionStorage.setItem("pending_2fa", JSON.stringify(pending));
        navigate("/verify-2fa", { state: pending });
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Sign in to continue to your dashboard, approvals, and live asset operations."
      footer={
        <div className="space-y-3">
          <p>
            Don&apos;t have an account?{" "}
            <Link to="/register" className="font-semibold text-sky-300 hover:text-sky-200">
              Create one
            </Link>
          </p>
          <p className="text-xs text-slate-500">Secure. Private. Professional asset management.</p>
        </div>
      }
    >
      {error ? <Alert type="error" message={error} onClose={() => setError("")} className="mb-5" /> : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          id="login-email"
          label="Email Address"
          type="email"
          value={email}
          onChange={(event) => {
            const value = event.target.value;
            setEmail(value);
            setErrors((prev) => ({ ...prev, email: validateField("email", value) }));
          }}
          onBlur={(event) => setErrors((prev) => ({ ...prev, email: validateField("email", event.target.value) }))}
          placeholder="Enter your registered email"
          autoComplete="email"
          error={errors.email}
          required
        />

        <Input
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(event) => {
            const value = event.target.value;
            setPassword(value);
            setErrors((prev) => ({ ...prev, password: validateField("password", value) }));
          }}
          onBlur={(event) => setErrors((prev) => ({ ...prev, password: validateField("password", event.target.value) }))}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={errors.password}
          required
        />

        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading} disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "../utils/axiosConfig";
import { Alert, Button, Input, PasswordStrengthMeter } from "../components/UI";
import AuthShell from "../components/AuthShell";
import { getPasswordRequirements } from "../utils/validation";
import { validateConfirmPasswordField, validatePasswordField } from "../utils/formValidation";

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
  const [fieldErrors, setFieldErrors] = useState({ password: "", confirmPassword: "" });
  const redirectTimerRef = useRef(null);

  const passwordRequirements = getPasswordRequirements();

  useEffect(() => {
    let isMounted = true;

    const verifyToken = async () => {
      if (!token) {
        if (isMounted) {
          setError("Invalid or missing reset token.");
          setVerifying(false);
        }
        return;
      }

      try {
        const { data } = await axios.get(`/auth/reset-password/${token}`);
        const payload = data?.data || data;
        if (!isMounted) return;
        setIsValid(true);
        setEmail(payload?.email || "");
      } catch (err) {
        if (isMounted) {
          setError(err.userFacingMessage || err.response?.data?.message || "This reset link is invalid or expired.");
        }
      } finally {
        if (isMounted) setVerifying(false);
      }
    };

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {
      password: validatePasswordField(formData.password),
      confirmPassword: validateConfirmPasswordField(formData.confirmPassword, formData.password),
    };
    setFieldErrors(nextErrors);

    if (nextErrors.password || nextErrors.confirmPassword) {
      setError("Please correct the highlighted password fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await axios.post(`/auth/reset-password/${token}`, {
        password: formData.password,
      });
      setMessage(data.message || "Password updated successfully.");
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.userFacingMessage || err.response?.data?.message || "Failed to reset password. Please request a new link.");
    } finally {
      setLoading(false);
    }
  };

  let content = null;

  if (verifying) {
    content = (
      <div className="flex flex-col items-center py-10">
        <div className="mb-4 h-12 w-12 rounded-full border-4 border-sky-400/20 border-t-sky-400 animate-spin" />
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">Verifying reset token</p>
      </div>
    );
  } else if (message) {
    content = (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-2xl text-emerald-200">
          OK
        </div>
        <Alert type="success" title="Password Updated" message={message} />
        <p className="text-sm text-slate-400">Redirecting to login...</p>
      </div>
    );
  } else if (!isValid) {
    content = (
      <div className="space-y-5 text-center">
        <Alert type="error" message={error} />
        <Link to="/forgot-password" className="btn btn-secondary w-full">
          Request New Reset Link
        </Link>
      </div>
    );
  } else {
    content = (
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          id="reset-password"
          label="New Password"
          type="password"
          placeholder="Enter a strong password"
          value={formData.password}
          onChange={(event) => {
            const value = event.target.value;
            setFormData((prev) => ({ ...prev, password: value }));
            setFieldErrors((prev) => ({
              ...prev,
              password: validatePasswordField(value),
              confirmPassword: formData.confirmPassword
                ? validateConfirmPasswordField(formData.confirmPassword, value)
                : prev.confirmPassword,
            }));
          }}
          onBlur={(event) => setFieldErrors((prev) => ({ ...prev, password: validatePasswordField(event.target.value) }))}
          error={fieldErrors.password}
          required
        />

        {formData.password ? (
          <PasswordStrengthMeter password={formData.password} requirements={passwordRequirements} />
        ) : null}

        <Input
          id="reset-confirm-password"
          label="Confirm Password"
          type="password"
          placeholder="Re-enter your password"
          value={formData.confirmPassword}
          onChange={(event) => {
            const value = event.target.value;
            setFormData((prev) => ({ ...prev, confirmPassword: value }));
            setFieldErrors((prev) => ({
              ...prev,
              confirmPassword: validateConfirmPasswordField(value, formData.password),
            }));
          }}
          onBlur={(event) => setFieldErrors((prev) => ({
            ...prev,
            confirmPassword: validateConfirmPasswordField(event.target.value, formData.password),
          }))}
          error={fieldErrors.confirmPassword}
          required
        />

        {error ? <Alert type="error" message={error} onClose={() => setError("")} /> : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={loading || !!fieldErrors.password || !!fieldErrors.confirmPassword || !formData.password || !formData.confirmPassword}
        >
          {loading ? "Updating..." : "Update Password"}
        </Button>
      </form>
    );
  }

  return (
    <AuthShell
      title="Reset Password"
      subtitle={`Set a new password${email ? ` for ${email}` : " for your account"}.`}
      footer={
        <p>
          Need a different link?{" "}
          <Link to="/forgot-password" className="font-semibold text-sky-300 hover:text-sky-200">
            Request a new reset email
          </Link>
        </p>
      }
    >
      {content}
    </AuthShell>
  );
}

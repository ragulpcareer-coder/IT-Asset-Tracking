import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "../utils/axiosConfig";
import { Alert, Button, Input } from "../components/UI";
import AuthShell from "../components/AuthShell";
import { validateEmailField } from "../utils/formValidation";

const COOLDOWN_SECONDS = 30;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const remainingCooldown = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const validateField = (value) => validateEmailField(value, "Email");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading || remainingCooldown > 0) return;

    const trimmedEmail = email.trim();
    const nextError = validateField(trimmedEmail);
    if (nextError) {
      setEmailError(nextError);
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
    <AuthShell
      title="Account Recovery"
      subtitle="Enter your registered email address and we'll send a secure password reset link."
      footer={
        <p>
          Remembered your password?{" "}
          <Link to="/login" className="font-semibold text-sky-300 hover:text-sky-200">
            Back to login
          </Link>
        </p>
      }
    >
      {message ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-sky-400/30 bg-sky-400/10 text-2xl text-sky-200">
            @
          </div>
          <Alert type="info" title="Request Received" message={message} />
          <Link to="/login" className="btn btn-primary w-full">
            Return to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Input
            id="forgot-email"
            label="Official Email Address"
            type="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(event) => {
              const value = event.target.value;
              setEmail(value);
              setEmailError(validateField(value));
            }}
            onBlur={(event) => setEmailError(validateField(event.target.value))}
            error={emailError}
            required
          />

          {error ? <Alert type="error" message={error} onClose={() => setError("")} /> : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={loading}
            disabled={loading || remainingCooldown > 0}
          >
            {loading ? "Sending..." : remainingCooldown > 0 ? `Try again in ${remainingCooldown}s` : "Send Reset Link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

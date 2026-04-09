import React, { useContext, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Alert, Button, Input } from "../components/UI";
import AuthShell from "../components/AuthShell";
import { validateVerificationCode } from "../utils/formValidation";

export default function Verify2FA() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verify2FA } = useContext(AuthContext);

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  const pending = useMemo(() => {
    const stateUser = location.state?.userId;
    const stored = sessionStorage.getItem("pending_2fa");
    if (stateUser) {
      const payload = { userId: location.state.userId, email: location.state.email || "" };
      sessionStorage.setItem("pending_2fa", JSON.stringify(payload));
      return payload;
    }
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (_) {
        return null;
      }
    }
    return null;
  }, [location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!pending?.userId) {
      setError("Your sign-in session expired. Please login again.");
      return;
    }

    const nextFieldError = validateVerificationCode(token);
    if (nextFieldError) {
      setFieldError(nextFieldError);
      return;
    }

    try {
      setLoading(true);
      await verify2FA(pending.userId, token);
      sessionStorage.removeItem("pending_2fa");
      navigate("/dashboard");
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || "Invalid verification code. Please try again.");
      if (data?.code === "2FA_SECRET_CORRUPT") {
        sessionStorage.removeItem("pending_2fa");
      }
      setToken("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Verify Identity"
      subtitle={`Enter the 6-digit code from your authenticator app${pending?.email ? ` for ${pending.email}` : ""}.`}
      footer={
        <p>
          Need to restart sign-in?{" "}
          <Link to="/login" className="font-semibold text-sky-300 hover:text-sky-200">
            Back to login
          </Link>
        </p>
      }
      maxWidth="max-w-md"
    >
      {error ? <Alert type="error" message={error} onClose={() => setError("")} className="mb-5" /> : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          id="verification-code"
          label="Verification Code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={token}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, "").slice(0, 6);
            setToken(value);
            setFieldError(validateVerificationCode(value));
            if (error) setError("");
          }}
          onBlur={(event) => setFieldError(validateVerificationCode(event.target.value))}
          placeholder="000000"
          autoFocus
          error={fieldError}
          required
          inputClassName="text-center font-mono text-3xl tracking-[0.45em]"
        />

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading} disabled={loading}>
          {loading ? "Verifying..." : "Verify & Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
}

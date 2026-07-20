import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Alert } from "../components/UI";
import { validateEmailField, validateRequired } from "../utils/formValidation";

const featureRows = [
  ["Asset Inventory", "Track all company devices"],
  ["Ownership", "Assign and manage assets"],
  ["Security Monitoring", "Monitor compliance and risks"],
  ["Lifecycle Management", "Purchase -> Assignment -> Retirement"],
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

    try {
      setLoading(true);
      await login(email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      const data = err.response?.data;
      setError(err.userFacingMessage || data?.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const emailIsValid = email.trim() && !errors.email && email.includes("@");
  const passwordIsValid = password && !errors.password;

  return (
    <main className="enterprise-login" aria-labelledby="login-page-title">
      <div className="enterprise-login__shell">
        <section className="enterprise-login__hero" aria-label="Platform summary">
          <div className="enterprise-login__badge">Secure Operations Access</div>
          <h1 id="login-page-title">IT Asset Tracking Portal</h1>
          <p className="enterprise-login__description">
            Manage inventory, ownership, lifecycle and security posture from one centralized platform.
          </p>

          <div className="enterprise-login__features">
            {featureRows.map(([title, description]) => (
              <div className="enterprise-login__feature" key={title}>
                <span className="enterprise-login__feature-icon" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <div className="enterprise-login__feature-title">{title}</div>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="enterprise-login__security">
            Protected with Role-Based Access • Secure Sessions • MFA Support
          </p>
        </section>

        <section className="enterprise-login__auth" aria-label="Sign in form">
          <div className="enterprise-login__card">
            <div className="enterprise-login__card-header">
              <h2>Sign in</h2>
              <p>Use your approved organization account.</p>
            </div>

            {error ? <Alert type="error" message={error} onClose={() => setError("")} className="mb-5" /> : null}

            <form onSubmit={handleSubmit} className="enterprise-login__form" noValidate>
              <div className="enterprise-login__field">
                <label htmlFor="login-email">Email</label>
                <div
                  className={`enterprise-login__input-wrap ${errors.email ? "is-error" : ""} ${
                    emailIsValid ? "is-success" : ""
                  }`}
                >
                  <input
                    id="login-email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setErrors((prev) => ({ ...prev, email: validateField("email", event.target.value) }));
                    }}
                    onBlur={(event) =>
                      setErrors((prev) => ({ ...prev, email: validateField("email", event.target.value) }))
                    }
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "login-email-error" : undefined}
                    autoFocus
                    required
                  />
                  {emailIsValid ? <span aria-hidden="true">✓</span> : null}
                </div>
                {errors.email ? (
                  <p id="login-email-error" className="enterprise-login__error" role="alert">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="enterprise-login__field">
                <div className="enterprise-login__label-row">
                  <label htmlFor="login-password">Password</label>
                  <Link to="/forgot-password">Forgot password?</Link>
                </div>
                <div
                  className={`enterprise-login__input-wrap ${errors.password ? "is-error" : ""} ${
                    passwordIsValid ? "is-success" : ""
                  }`}
                >
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrors((prev) => ({ ...prev, password: validateField("password", event.target.value) }));
                    }}
                    onBlur={(event) =>
                      setErrors((prev) => ({ ...prev, password: validateField("password", event.target.value) }))
                    }
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "login-password-error" : undefined}
                    required
                  />
                  <button
                    type="button"
                    className="enterprise-login__password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password ? (
                  <p id="login-password-error" className="enterprise-login__error" role="alert">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <label className="enterprise-login__check">
                <input type="checkbox" />
                <span>Keep me signed in</span>
              </label>

              <button className="enterprise-login__submit" type="submit" disabled={loading} aria-busy={loading}>
                {loading ? (
                  <>
                    <span className="enterprise-login__spinner" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="enterprise-login__request">
              <span>Need access?</span>
              <Link to="/register">Request an account</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

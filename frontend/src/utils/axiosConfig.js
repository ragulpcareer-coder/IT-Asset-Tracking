import axios from "axios";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.1 });

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const fallbackBaseURL = isLocal ? "http://localhost:5000/api" : "/api";

const normalizeApiBase = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return fallbackBaseURL;
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return fallbackBaseURL;
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
};

const baseURL = normalizeApiBase(import.meta.env.VITE_API_URL || fallbackBaseURL);

const instance = axios.create({
  baseURL,
  withCredentials: true,
});

let activeRequests = 0;

instance.interceptors.request.use(
  (config) => {
    if (activeRequests === 0) NProgress.start();
    activeRequests += 1;

    return config;
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) NProgress.done();
    return Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) NProgress.done();
    return response;
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) NProgress.done();

    const status = error.response?.status;
    const payload = error.response?.data || {};
    const requestUrl = String(error.config?.url || "");

    const is2FAStep = payload?.requires2FA || payload?.code === "2FA_INVALID";
    const isStepUp = payload?.reauthRequired || payload?.code === "STEP_UP_REQUIRED";
    if ((status === 401 || status === 403) && (is2FAStep || isStepUp)) {
      return Promise.reject(error);
    }

    const authFailureCodes = new Set(["AUTH_401", "SESSION_REVOKED", "TOKEN_REUSE_DETECTED"]);
    const authFailureMessage = String(payload?.message || "").toLowerCase();
    const isAuthFailureMessage =
      authFailureMessage.includes("not authorized") ||
      authFailureMessage.includes("token") ||
      authFailureMessage.includes("session expired");

    const shouldForceLogout =
      status === 401 &&
      (
        authFailureCodes.has(payload?.code) ||
        isAuthFailureMessage ||
        requestUrl.includes("/auth/me")
      );

    if (shouldForceLogout) {
      if (!["/login", "/verify-2fa"].includes(window.location.pathname)) {
        axios.post(`${baseURL}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
      }
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default instance;

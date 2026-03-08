import axios from "axios";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.1 });

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const fallbackBaseURL = isLocal ? "http://localhost:5000/api" : "https://it-asset-tracking.onrender.com/api";
const baseURL = import.meta.env.VITE_API_URL || fallbackBaseURL;

const instance = axios.create({
  baseURL,
  withCredentials: true,
});

let activeRequests = 0;

instance.interceptors.request.use(
  (config) => {
    if (activeRequests === 0) {
      NProgress.start();
    }
    activeRequests++;

    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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

    if (error.response?.status === 401 && !error.response?.data?.requires2FA) {
      if (["/login", "/verify-2fa"].includes(window.location.pathname) || error.response?.data?.code === "2FA_INVALID") return Promise.reject(error);

      axios.post(`${baseURL}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default instance;



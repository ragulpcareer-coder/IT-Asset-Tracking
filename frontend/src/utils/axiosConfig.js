import axios from "axios";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { toast } from "react-toastify";

NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.1 });

// Detect if we are in production or local development
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const baseURL = isLocal ? "http://localhost:5000/api" : "https://it-asset-tracking.onrender.com/api";

const instance = axios.create({
  baseURL,
  withCredentials: true, // MUST remain true for sending HttpOnly Cookies
});

let activeRequests = 0;

instance.interceptors.request.use((config) => {
  if (activeRequests === 0) {
    NProgress.start();
  }
  activeRequests++;
  return config;
}, (error) => {
  activeRequests--;
  if (activeRequests === 0) NProgress.done();
  return Promise.reject(error);
});

instance.interceptors.response.use(
  (response) => {
    activeRequests--;
    if (activeRequests === 0) NProgress.done();
    return response;
  },
  (error) => {
    activeRequests--;
    if (activeRequests === 0) NProgress.done();

    // Global Unauthorized Handler (only show if it's not a specific 2FA requirement)
    if (error.response?.status === 401 && !error.response?.data?.requires2FA) {
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default instance;

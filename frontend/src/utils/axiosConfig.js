import axios from "axios";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { toast } from "react-toastify";

NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.1 });

let baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
if (!baseURL.endsWith("/api")) {
  baseURL += "/api";
}

const instance = axios.create({
  baseURL,
});

let activeRequests = 0;

instance.interceptors.request.use((config) => {
  if (activeRequests === 0) {
    NProgress.start();
  }
  activeRequests++;

  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

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
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default instance;

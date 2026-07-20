import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "../utils/axiosConfig";
import { setSocketUserIdentity } from "../services/socket";
import { toast } from "react-toastify";

export const AuthContext = createContext();

const resolveUserPayload = (responseData) => {
  if (!responseData) return null;
  return responseData.user || responseData;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasBootstrappedRef = useRef(false);

  const loadUser = useCallback(async (signal) => {
    try {
      const res = await axios.get("/auth/me", { signal });
      setUser(resolveUserPayload(res.data));
    } catch (error) {
      if (error?.name !== "CanceledError" && error?.name !== "AbortError") {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return undefined;
    }
    hasBootstrappedRef.current = true;
    const controller = new AbortController();
    loadUser(controller.signal);
    return () => controller.abort();
  }, [loadUser]);

  useEffect(() => {
    setSocketUserIdentity(user?._id || user?.id || null);
  }, [user]);

  const login = useCallback(async (email, password) => {
    try {
      const res = await axios.post("/auth/login", { email, password });
      setUser(resolveUserPayload(res.data));
      return res.data;
    } catch (error) {
      if (!error.response) {
        error.userFacingMessage = "Backend server is unavailable. Start the API server and try again.";
      }
      throw error;
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    try {
      const res = await axios.post("/auth/register", { name, email, password });
      setUser(resolveUserPayload(res.data));
      return res.data;
    } catch (error) {
      if (!error.response) {
        error.userFacingMessage = "Backend server is unavailable. Start the API server and try again.";
      }
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post("/auth/logout");
    } catch (error) {
      toast.error(error?.response?.data?.message || "We couldn't confirm logout with the server. Your local session has been cleared.");
    } finally {
      setSocketUserIdentity(null);
      setUser(null);
      window.location.href = "/login";
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await axios.get("/auth/me");
      setUser(resolveUserPayload(res.data));
      return resolveUserPayload(res.data);
    } catch (error) {
      if (error?.response?.status === 401) {
        setUser(null);
      }
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      register,
      logout,
      refreshUser,
      loading,
    }),
    [user, login, register, logout, refreshUser, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

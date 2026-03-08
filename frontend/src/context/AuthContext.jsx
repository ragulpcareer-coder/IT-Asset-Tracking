import React, { createContext, useState, useEffect } from "react";
import axios from "../utils/axiosConfig";
import { setSocketUserIdentity } from "../services/socket";

export const AuthContext = createContext();

const resolveUserPayload = (responseData) => {
  if (!responseData) return null;
  return responseData.user || responseData;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setUser(null);
          return;
        }
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await axios.get("/auth/me", config);
        setUser(resolveUserPayload(res.data));
      } catch (error) {
        if (error?.response?.status === 401) {
          localStorage.removeItem("token");
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    setSocketUserIdentity(user?._id || user?.id || null);
  }, [user]);

  const login = async (email, password, token2FA = "", fingerprint = {}) => {
    const res = await axios.post("/auth/login", { email, password, token2FA, fingerprint });
    if (res.data.requires2FA) {
      return res.data;
    }

    if (res.data.token || res.data.accessToken) {
      localStorage.setItem("token", res.data.accessToken || res.data.token);
    }
    setUser(resolveUserPayload(res.data));
    return res.data;
  };

  const verify2FA = async (userId, token) => {
    const res = await axios.post("/auth/verify-2fa", { userId, token });
    if (res.data.token || res.data.accessToken) {
      localStorage.setItem("token", res.data.accessToken || res.data.token);
    }
    setUser(resolveUserPayload(res.data));
    return res.data;
  };

  const register = async (name, email, password, role) => {
    const res = await axios.post("/auth/register", {
      name,
      email,
      password,
      role,
    });

    return res.data;
  };

  const logout = async () => {
    try {
      await axios.post("/auth/logout");
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem("token");
    setSocketUserIdentity(null);
    setUser(null);
    window.location.href = "/login";
  };

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem("token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await axios.get("/auth/me", config);
      setUser(resolveUserPayload(res.data));
    } catch (error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem("token");
        setUser(null);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        verify2FA,
        register,
        logout,
        refreshUser,
        loading,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};



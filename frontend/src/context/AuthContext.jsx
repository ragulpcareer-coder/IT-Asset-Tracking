import React, { createContext, useState, useEffect } from "react";
import axios from "../utils/axiosConfig";

// Create Context
export const AuthContext = createContext();

// Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from endpoint on first load via Header/Cookie
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get("/auth/me", config);
        setUser(res.data);
      } catch (error) {
        console.error("Failed to load user auth", error);
        localStorage.removeItem("token");
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  // Login Function
  const login = async (email, password, token2FA = "", fingerprint = {}) => {
    const res = await axios.post("/auth/login", { email, password, token2FA, fingerprint });
    localStorage.setItem("token", res.data.accessToken || res.data.token);
    setUser(res.data);
    return res.data;
  };

  // Register Function
  const register = async (name, email, password, role) => {
    const res = await axios.post("/auth/register", {
      name,
      email,
      password,
      role,
    });

    if (res.data.accessToken || res.data.token) {
      localStorage.setItem("token", res.data.accessToken || res.data.token);
      setUser(res.data);
    }

    return res.data;
  };

  // Logout Function
  const logout = async () => {
    try {
      await axios.post("/auth/logout");
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem("token");
    setUser(null);
    window.location.href = "/login";
  };

  // Refresh User Function
  const refreshUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get("/auth/me");
      setUser(res.data);
    } catch (error) {
      console.error("Refresh user failed", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
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

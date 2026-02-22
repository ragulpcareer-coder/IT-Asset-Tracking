import React, { createContext, useState, useEffect } from "react";
import axios from "../utils/axiosConfig";

// Create Context
export const AuthContext = createContext();

// Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from endpoint on first load via HttpOnly cookie
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await axios.get("/auth/me");
        setUser(res.data);
      } catch (error) {
        console.error("Failed to load user implicitly via cookies", error);
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  // Login Function
  const login = async (email, password, token2FA = "") => {
    const res = await axios.post("/auth/login", { email, password, token2FA });
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
    setUser(res.data);
    return res.data;
  };

  // Logout Function
  const logout = async () => {
    try {
      await axios.post("/auth/logout");
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        loading,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

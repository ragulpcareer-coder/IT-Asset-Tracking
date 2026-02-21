import React, { createContext, useState, useEffect } from "react";
import axios from "../utils/axiosConfig";

// Create Context
export const AuthContext = createContext();

// Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on first load
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          // Set loading to true while fetching
          // In a real app, you'd fetch /api/auth/me here
          // For now, we'll decode or just trust the token exists
          // Better: axios.get('/auth/me')
          const res = await axios.get("/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser({ ...res.data, token });
        } catch (error) {
          console.error("Failed to load user", error);
          localStorage.removeItem("token");
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  // Login Function
  const login = async (email, password, token2FA = "") => {
    const res = await axios.post("/auth/login", { email, password, token2FA });
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
    localStorage.setItem("token", res.data.accessToken || res.data.token);
    setUser(res.data);
    return res.data;
  };

  // Logout Function
  const logout = () => {
    localStorage.removeItem("token");
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

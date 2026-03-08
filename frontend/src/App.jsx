import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/layout/Layout";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";
import LoadingSpinner from "./components/common/LoadingSpinner";
import SecurityAlertBanner from "./components/SecurityAlertBanner";
import "./modern.css";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Assets = lazy(() => import("./pages/Assets"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const Verify2FA = lazy(() => import("./pages/Verify2FA"));
const Register = lazy(() => import("./pages/Register"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Users = lazy(() => import("./pages/Users"));
const Cybersecurity = lazy(() => import("./pages/Cybersecurity"));

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <SecurityAlertBanner />
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/verify-2fa" element={<Verify2FA />} />
            <Route path="/register" element={<Register />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <Layout>
                    <Users />
                  </Layout>
                </AdminRoute>
              }
            />
            <Route
              path="/security"
              element={
                <AdminRoute>
                  <Layout>
                    <Cybersecurity />
                  </Layout>
                </AdminRoute>
              }
            />
            <Route
              path="/assets"
              element={
                <PrivateRoute>
                  <Layout>
                    <Assets />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <AdminRoute>
                  <Layout>
                    <AuditLogs />
                  </Layout>
                </AdminRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}



import React, { useState, useContext, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import { Button, Input, Card, Badge, PasswordStrengthMeter, Alert } from "../components/UI";
import { ProfessionalIcon, RoleBadge } from "../components/ProfessionalIcons";
import { getPasswordRequirements } from "../utils/validation";
import { animationVariants, transitionPresets } from "../utils/animations";
import { theme } from "../config/theme";

const DEPARTMENTS = [
  "IT Support",
  "Security Operations",
  "Administration",
  "Management",
  "Human Resources",
  "Finance",
  "Operations",
  "Legal",
  "Research & Development",
];

// ── Password strength validator ──────────────────────────────────────────────
function validatePassword(pwd) {
  return {
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSpecial: /[^A-Za-z0-9]/.test(pwd),
  };
}

// ── Inline confirmation modal (replaces window.confirm) ──────────────────────
function ConfirmationModal({ isOpen, title, message, confirmLabel, confirmVariant = "danger", onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="text-2xl mb-3 text-center">⚠️</div>
        <h3 className="text-white font-bold text-lg text-center mb-2">{title}</h3>
        <p className="text-gray-400 text-sm text-center mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/30 font-medium text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition ${confirmVariant === "danger"
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Settings() {
  const { user, logout, refreshUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activityFilter, setActivityFilter] = useState("All");

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwdErrors, setPwdErrors] = useState({});
  const [showPwdReqs, setShowPwdReqs] = useState(false);

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    department: user?.department || "",
    avatar: user?.avatar || "",
  });
  const [profileErrors, setProfileErrors] = useState({});

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: true,
    activityNotifications: true,
    securityAlerts: true,
    theme: "dark",
    sessionTimeout: 30,
    twoFactorEnabled: user?.twoFactorEnabled || false,
  });

  const [tfaSetup, setTfaSetup] = useState({
    qrCode: null,
    secret: null,
    token: "",
    isSettingUp: false,
  });

  const [realActivity, setRealActivity] = useState([]);

  const timeAgo = (date) => {
    if (!date) return "Never";
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return "Just now";
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  };

  const fetchActivity = async () => {
    try {
      const res = await axios.get("/auth/activity");
      setRealActivity(res.data || []);
    } catch (err) {
      console.error("Failed to fetch activity logs");
    }
  };

  React.useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        department: user.department || "",
        avatar: user.avatar || "",
      });
      setPreferences({
        emailNotifications: user.preferences?.emailNotifications ?? true,
        pushNotifications: user.preferences?.pushNotifications ?? true,
        activityNotifications: user.preferences?.activityNotifications ?? true,
        securityAlerts: user.preferences?.securityAlerts ?? true,
        trackLocation: user.preferences?.trackLocation ?? true,
        trackIP: user.preferences?.trackIP ?? true,
        theme: user.preferences?.theme || "dark",
        sessionTimeout: user.preferences?.sessionTimeout || 30,
        twoFactorEnabled: user.twoFactorEnabled || false,
      });
      fetchActivity();
    }
  }, [user]);

  const updatePreferences = async (newPrefs) => {
    try {
      setLoading(true);
      await axios.put("/auth/profile", { preferences: newPrefs });
      setPreferences((prev) => ({ ...prev, ...newPrefs }));
      await refreshUser();
      await fetchActivity();
      toast.success("Preferences saved successfully.");
    } catch (error) {
      toast.error("Failed to save preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Profile validation ──────────────────────────────────────────────────────
  const validateProfile = () => {
    const errs = {};
    if (!profileData.name.trim() || profileData.name.trim().length < 3)
      errs.name = "Full name must be at least 3 characters.";
    if (profileData.name.trim().length > 50)
      errs.name = "Full name must be 50 characters or fewer.";
    if (/\d/.test(profileData.name))
      errs.name = "Full name must not contain numbers.";
    if (profileData.phone && !/^\+?[0-9\s\-().]{7,20}$/.test(profileData.phone))
      errs.phone = "Enter a valid phone number (e.g. +91 9876543210).";
    setProfileErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Password validation ─────────────────────────────────────────────────────
  const validatePasswordForm = () => {
    const errs = {};
    if (!passwordData.currentPassword) errs.currentPassword = "Current password is required.";
    const reqs = validatePassword(passwordData.newPassword);
    if (!reqs.minLength) errs.newPassword = "Password must be at least 8 characters.";
    else if (!reqs.hasUpper) errs.newPassword = "Add at least one uppercase letter.";
    else if (!reqs.hasLower) errs.newPassword = "Add at least one lowercase letter.";
    else if (!reqs.hasNumber) errs.newPassword = "Add at least one number.";
    else if (!reqs.hasSpecial) errs.newPassword = "Add at least one special character (e.g. @, #, !).";
    if (passwordData.newPassword !== passwordData.confirmPassword)
      errs.confirmPassword = "Passwords do not match.";
    setPwdErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: "user" },
    { id: "security", label: "Security", icon: "lock" },
    { id: "preferences", label: "Preferences", icon: "settings" },
    { id: "devices", label: "Sessions", icon: "smartphone" },
    { id: "activity", label: "Activity", icon: "activity" },
  ];

  const inputClass =
    "w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white caret-white outline-none focus:border-white/30 transition-all font-medium";
  const errorClass = "text-red-400 text-xs mt-1 flex items-center gap-1";

  // ─────────────────────────────────────────────────────────────────────────────
  // PROFILE TAB
  // ─────────────────────────────────────────────────────────────────────────────
  const ProfileTab = () => (
    <motion.div className="space-y-6 max-w-2xl" initial="hidden" animate="visible" variants={animationVariants.containerVariants}>
      <motion.div variants={animationVariants.itemVariants}>
        <h2 className="text-xl font-medium text-white mb-6">User Profile</h2>

        {/* Avatar card */}
        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center gap-6">
            <motion.div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white bg-[#111] border border-white/10"
              whileHover={{ scale: 1.05 }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </motion.div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Signed in as</p>
              <p className="text-xl font-semibold text-white">{user?.name}</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs font-semibold">
                  Verified
                </span>
                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-xs font-semibold">
                  {user?.role || "User"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!validateProfile()) return;
            try {
              setLoading(true);
              await axios.put("/auth/profile", profileData);
              await refreshUser();
              await fetchActivity();
              toast.success("Profile updated successfully.");
            } catch (error) {
              toast.error(error.response?.data?.message || "Failed to update profile. Please try again.");
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-5"
        >
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="user" size={16} />
                Full Name <span className="text-red-400">*</span>
              </div>
            </label>
            <input
              type="text"
              value={profileData.name}
              maxLength={50}
              onChange={(e) => {
                setProfileData({ ...profileData, name: e.target.value });
                if (profileErrors.name) setProfileErrors((p) => ({ ...p, name: "" }));
              }}
              required
              className={`${inputClass} ${profileErrors.name ? "border-red-500/50" : ""}`}
              style={{ color: "white" }}
            />
            {profileErrors.name && <p className={errorClass}>⚠ {profileErrors.name}</p>}
          </div>

          {/* Email — read-only */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="email" size={16} />
                Email Address
              </div>
            </label>
            <input
              type="email"
              value={profileData.email}
              disabled
              className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-gray-500 cursor-not-allowed outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed for security reasons.</p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="smartphone" size={16} />
                Phone Number
              </div>
            </label>
            <input
              type="tel"
              placeholder="+91 9876543210"
              value={profileData.phone}
              onChange={(e) => {
                setProfileData({ ...profileData, phone: e.target.value });
                if (profileErrors.phone) setProfileErrors((p) => ({ ...p, phone: "" }));
              }}
              className={`${inputClass} ${profileErrors.phone ? "border-red-500/50" : ""}`}
              style={{ color: "white" }}
            />
            {profileErrors.phone && <p className={errorClass}>⚠ {profileErrors.phone}</p>}
          </div>

          {/* Department — dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="building" size={16} />
                Department
              </div>
            </label>
            <select
              value={profileData.department}
              onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
              className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-white/30 transition-all font-medium"
              style={{ color: profileData.department ? "white" : "#6b7280" }}
            >
              <option value="">Select your department</option>
              {(Array.isArray(DEPARTMENTS) ? DEPARTMENTS : []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={loading} className="w-full">
              {loading ? "Updating..." : "Update Profile"}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </motion.div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SECURITY TAB
  // ─────────────────────────────────────────────────────────────────────────────
  const SecurityTab = () => {
    const pwdReqs = validatePassword(passwordData.newPassword);
    return (
      <motion.div className="space-y-6 max-w-2xl" initial="hidden" animate="visible" variants={animationVariants.containerVariants}>
        <motion.div variants={animationVariants.itemVariants}>
          <h2 className="text-xl font-medium text-white mb-6">Security Settings</h2>

          {/* Change Password */}
          <div className="mb-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0a]">
            <h3 className="text-lg font-medium text-white mb-1 flex items-center gap-2">
              🔑 Change Password
            </h3>
            <p className="text-xs text-gray-500 mb-4">Use a strong password with uppercase, lowercase, numbers, and special characters.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!validatePasswordForm()) return;
                try {
                  setLoading(true);
                  await axios.post("/auth/change-password", {
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword,
                  });
                  await refreshUser();
                  await fetchActivity();
                  toast.success("Password changed successfully.");
                  setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  setPwdErrors({});
                  setShowPwdReqs(false);
                } catch (error) {
                  toast.error(error.response?.data?.message || "Failed to change password. Please check your current password.");
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-4"
            >
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, currentPassword: e.target.value });
                    if (pwdErrors.currentPassword) setPwdErrors((p) => ({ ...p, currentPassword: "" }));
                  }}
                  required
                  className={`${inputClass} ${pwdErrors.currentPassword ? "border-red-500/50" : ""}`}
                  style={{ color: "white" }}
                />
                {pwdErrors.currentPassword && <p className={errorClass}>⚠ {pwdErrors.currentPassword}</p>}
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onFocus={() => setShowPwdReqs(true)}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, newPassword: e.target.value });
                    if (pwdErrors.newPassword) setPwdErrors((p) => ({ ...p, newPassword: "" }));
                  }}
                  required
                  className={`${inputClass} ${pwdErrors.newPassword ? "border-red-500/50" : ""}`}
                  style={{ color: "white" }}
                />
                {pwdErrors.newPassword && <p className={errorClass}>⚠ {pwdErrors.newPassword}</p>}

                {/* Inline password requirements */}
                {showPwdReqs && passwordData.newPassword && (
                  <div className="mt-2 space-y-1">
                    {[
                      { key: "minLength", label: "At least 8 characters" },
                      { key: "hasUpper", label: "One uppercase letter" },
                      { key: "hasLower", label: "One lowercase letter" },
                      { key: "hasNumber", label: "One number" },
                      { key: "hasSpecial", label: "One special character (@, #, !...)" },
                    ].map((req) => (
                      <p key={req.key} className={`text-[11px] flex items-center gap-1 ${(Array.isArray(pwdReqs) ? pwdReqs[req.key] : pwdReqs?.[req.key]) ? "text-green-400" : "text-gray-500"}`}>
                        {(Array.isArray(pwdReqs) ? pwdReqs[req.key] : pwdReqs?.[req.key]) ? "✓" : "○"} {req.label}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                    if (pwdErrors.confirmPassword) setPwdErrors((p) => ({ ...p, confirmPassword: "" }));
                  }}
                  required
                  className={`${inputClass} ${pwdErrors.confirmPassword ? "border-red-500/50" : ""}`}
                  style={{ color: "white" }}
                />
                {pwdErrors.confirmPassword && <p className={errorClass}>⚠ {pwdErrors.confirmPassword}</p>}
                {passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword && (
                  <p className="text-green-400 text-[11px] mt-1 flex items-center gap-1">✓ Passwords match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-medium transition disabled:opacity-50"
              >
                {loading ? "Updating Password..." : "Change Password"}
              </button>
            </form>
          </div>

          {/* Two-Factor Authentication */}
          <div className="p-6 rounded-xl border border-white/10 bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  🔐 Two-Factor Authentication (2FA)
                </h3>
                <p className="text-sm text-gray-400 mt-2">
                  Add an extra layer of security. You'll need your phone to log in.
                </p>
                {preferences.twoFactorEnabled && (
                  <span className="inline-block mt-3 px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs font-semibold">
                    ✓ Enabled
                  </span>
                )}
              </div>
              {!tfaSetup.isSettingUp && (
                <button
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition ${preferences.twoFactorEnabled
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                    }`}
                  onClick={async () => {
                    try {
                      if (preferences.twoFactorEnabled) {
                        await axios.post("/auth/2fa/disable");
                        setPreferences((prev) => ({ ...prev, twoFactorEnabled: false }));
                        await refreshUser();
                        await fetchActivity();
                        toast.success("Two-Factor Authentication has been disabled.");
                      } else {
                        const res = await axios.post("/auth/2fa/generate");
                        setTfaSetup({ ...tfaSetup, qrCode: res.data.qrCode, secret: res.data.secret, isSettingUp: true });
                      }
                    } catch (e) {
                      toast.error("Failed to configure 2FA. Please try again.");
                    }
                  }}
                >
                  {preferences.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                </button>
              )}
            </div>

            {tfaSetup.isSettingUp && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <h4 className="text-white font-semibold mb-1">Step 1 — Scan the QR Code</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Open <strong className="text-white">Google Authenticator</strong> or <strong className="text-white">Microsoft Authenticator</strong>, then scan the QR code below.
                </p>
                <div className="bg-white p-2 inline-block rounded-lg mb-4">
                  <img src={tfaSetup.qrCode} alt="2FA QR Code" />
                </div>
                {tfaSetup.secret && (
                  <p className="text-xs text-gray-500 mb-4">
                    Manual entry key: <span className="font-mono text-gray-300 bg-white/5 px-1 rounded">{tfaSetup.secret}</span>
                  </p>
                )}
                <h4 className="text-white font-semibold mb-1">Step 2 — Enter the 6-digit Code</h4>
                <p className="text-sm text-gray-400 mb-3">Enter the code shown in your authenticator app to verify and enable 2FA.</p>
                <div className="space-y-4 max-w-sm">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g. 123456"
                    maxLength={6}
                    value={tfaSetup.token}
                    onChange={(e) => setTfaSetup({ ...tfaSetup, token: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white caret-white outline-none focus:border-white/30 tracking-widest text-center text-xl font-mono"
                    style={{ color: "white" }}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setTfaSetup({ qrCode: null, secret: null, token: "", isSettingUp: false })}
                      className="flex-1 px-4 py-2 rounded-lg font-medium text-sm text-gray-400 hover:text-white transition bg-white/5 hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (tfaSetup.token.length < 6) {
                          toast.error("Please enter a 6-digit code.");
                          return;
                        }
                        try {
                          await axios.post("/auth/2fa/verify", { token: tfaSetup.token.replace(/\s/g, "") });
                          setPreferences((prev) => ({ ...prev, twoFactorEnabled: true }));
                          setTfaSetup({ qrCode: null, secret: null, token: "", isSettingUp: false });
                          await refreshUser();
                          await fetchActivity();
                          toast.success("Two-Factor Authentication enabled successfully! Your account is now more secure.");
                        } catch (e) {
                          toast.error("Invalid code. Please check your authenticator app and try again.");
                        }
                      }}
                      className="flex-1 px-4 py-2 rounded-lg font-medium text-sm text-white bg-blue-600 hover:bg-blue-500 transition"
                    >
                      Verify & Enable
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PREFERENCES TAB
  // ─────────────────────────────────────────────────────────────────────────────
  const PreferencesTab = () => (
    <motion.div className="space-y-6 max-w-2xl" initial="hidden" animate="visible" variants={animationVariants.containerVariants}>
      <motion.div variants={animationVariants.itemVariants}>
        <h2 className="text-xl font-medium text-white mb-6">Notification Preferences</h2>

        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0a]">
          <div className="space-y-4">
            {(Array.isArray(preferences.list) ? preferences.list : [
              { key: "emailNotifications", label: "Email Notifications", description: "Receive updates and alerts via email.", icon: "email" },
              { key: "pushNotifications", label: "Push Notifications", description: "Receive real-time alerts inside the application.", icon: "notification" },
              { key: "activityNotifications", label: "Activity Updates", description: "Get notified when assets are added, changed, or removed.", icon: "activity" },
              { key: "securityAlerts", label: "Security Alerts", description: "Alerts for login attempts, password changes, and suspicious activity.", icon: "alert" },
            ]).map((pref) => (
              <motion.div
                key={pref.key}
                className="flex items-center justify-between p-4 rounded-lg bg-[#111] hover:bg-white/5 border border-white/5 transition"
                variants={animationVariants.itemVariants}
              >
                <div className="flex items-start gap-4">
                  <div className="text-cyan-400 mt-1">
                    <ProfessionalIcon name={pref.icon} size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{pref.label}</p>
                    <p className="text-sm text-gray-400">{pref.description}</p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  disabled={loading}
                  onClick={() => updatePreferences({ [pref.key]: !preferences[pref.key] })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  style={{ backgroundColor: preferences[pref.key] ? "#0ea5e9" : "#333" }}
                  title={preferences[pref.key] ? "Click to disable" : "Click to enable"}
                >
                  <motion.span
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    style={{ transform: preferences[pref.key] ? "translateX(24px)" : "translateX(4px)" }}
                  />
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-xl border border-white/10 bg-[#0a0a0a]">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white mb-1 flex items-center gap-2">🛡️ Privacy & Tracking Consent</h3>
            <p className="text-sm text-gray-400 mb-4">
              Control how your data is collected for security and device management purposes.
            </p>
            {(Array.isArray(preferences.tracking) ? preferences.tracking : [
              {
                key: "trackLocation",
                label: "Track General Location",
                description: "Used for device management and security auditing. Stores department and building info only — not GPS.",
                icon: "location",
              },
              {
                key: "trackIP",
                label: "Network Activity Monitoring",
                description: "Monitors login IP addresses and device behavior to detect unauthorized access.",
                icon: "activity",
              },
            ]).map((pref) => (
              <motion.div
                key={pref.key}
                className="flex items-center justify-between p-4 rounded-lg bg-[#111] hover:bg-white/5 border border-white/5 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="text-cyan-400 mt-1">
                    <ProfessionalIcon name={pref.icon} size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{pref.label}</p>
                    <p className="text-sm text-gray-400">{pref.description}</p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  disabled={loading}
                  onClick={() => updatePreferences({ [pref.key]: !preferences[pref.key] })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  style={{ backgroundColor: preferences[pref.key] !== false ? "#0ea5e9" : "#333" }}
                  title={preferences[pref.key] !== false ? "Click to disable" : "Click to enable"}
                >
                  <motion.span
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    style={{ transform: preferences[pref.key] !== false ? "translateX(24px)" : "translateX(4px)" }}
                  />
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SESSIONS TAB
  // ─────────────────────────────────────────────────────────────────────────────
  const DevicesTab = () => (
    <motion.div className="space-y-6 max-w-2xl" initial="hidden" animate="visible" variants={animationVariants.containerVariants}>
      <motion.div variants={animationVariants.itemVariants}>
        <h2 className="text-xl font-medium mb-6 text-white">Active Sessions</h2>

        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0a] relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
          <div className="pl-4">
            <p className="font-bold text-white mb-3 flex items-center gap-2">
              <ProfessionalIcon name="desktop" size={18} /> Current Session
            </p>
            <div className="space-y-1.5 text-sm text-gray-400">
              <p className="flex items-center gap-2">
                <span className="text-gray-600 w-20 text-xs">Device</span>
                {navigator.userAgent.includes("Chrome") ? "Chrome" : navigator.userAgent.includes("Firefox") ? "Firefox" : "Browser"}{" "}
                on {navigator.platform || "Desktop"}
              </p>
              <p className="flex items-center gap-2">
                <span className="text-gray-600 w-20 text-xs">Status</span>
                Active Now
              </p>
              <p className="flex items-center gap-2">
                <span className="text-gray-600 w-20 text-xs">Account</span>
                {user?.email}
              </p>
            </div>
            <span className="inline-block mt-3 px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs font-semibold">
              ● Active Now
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a] mb-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="text-amber-400 font-semibold">Note:</span> Using "Log Out From All Devices" will immediately invalidate all active sessions and refresh tokens. You will be logged out from this device too.
          </p>
        </div>

        <motion.div variants={animationVariants.itemVariants}>
          <button
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg py-3 font-semibold transition flex items-center justify-center gap-2"
            onClick={() => setShowLogoutModal(true)}
          >
            🚪 Log Out From All Devices
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIVITY TAB
  // ─────────────────────────────────────────────────────────────────────────────
  const ActivityTab = () => {
    const filterOptions = ["All", "Security", "Login", "2FA", "Profile", "Asset"];

    const filteredActivity = activityFilter === "All"
      ? realActivity
      : realActivity.filter((a) => {
        const t = (a.actionType || "").toLowerCase();
        if (activityFilter === "Security") return t.includes("security") || t.includes("alert") || t.includes("violation");
        if (activityFilter === "Login") return t.includes("login") || t.includes("logout");
        if (activityFilter === "2FA") return t.includes("2fa") || t.includes("two_factor");
        if (activityFilter === "Profile") return t.includes("profile") || t.includes("password");
        if (activityFilter === "Asset") return t.includes("asset");
        return true;
      });

    const getIcon = (type = "") => {
      const t = type.toLowerCase();
      if (t.includes("login") || t.includes("logout")) return "user";
      if (t.includes("password")) return "lock";
      if (t.includes("2fa") || t.includes("two_factor")) return "shield";
      if (t.includes("asset")) return "desktop";
      if (t.includes("profile")) return "user";
      return "activity";
    };

    return (
      <motion.div className="space-y-6 max-w-2xl" initial="hidden" animate="visible" variants={animationVariants.containerVariants}>
        <motion.div variants={animationVariants.itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium text-white">Activity Log</h2>
            <Button variant="outline" size="sm" onClick={fetchActivity}>
              <ProfessionalIcon name="refresh" size={14} className="mr-2" />
              Refresh
            </Button>
          </div>

          {/* Activity Filter Tabs */}
          <div className="flex gap-2 flex-wrap mb-6">
            {(Array.isArray(filterOptions) ? filterOptions : []).map((f) => (
              <button
                key={f}
                onClick={() => setActivityFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${activityFilter === f
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                  : "bg-white/5 text-gray-500 hover:text-gray-300 border border-white/5"
                  }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {!Array.isArray(filteredActivity) || filteredActivity.length === 0 ? (
              <div className="text-center py-10 border border-white/5 bg-white/5 rounded-xl">
                <p className="text-gray-500">No activity found{activityFilter !== "All" ? ` for filter: ${activityFilter}` : ""}.</p>
                <p className="text-gray-600 text-xs mt-1">Activity events will appear here as you use the application.</p>
              </div>
            ) : (
              Array.isArray(filteredActivity) && filteredActivity.map((activity, idx) => (
                <motion.div
                  key={activity._id || idx}
                  className="flex gap-4 p-4 rounded-xl border border-white/10 bg-[#0a0a0a] hover:bg-white/5 transition group"
                  variants={animationVariants.itemVariants}
                >
                  <div className="text-cyan-400 mt-1">
                    <ProfessionalIcon name={getIcon(activity.actionType)} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-white text-sm">
                        {(activity.actionType || "UNKNOWN").replace(/_/g, " ")}
                      </p>
                      <span className={`px-2 py-0.5 text-[10px] rounded border uppercase font-black shrink-0 ${activity.status === "success"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                        {activity.status || "info"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5 truncate">{activity.description}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-[11px] text-cyan-500/60 font-medium uppercase tracking-wider">
                        {timeAgo(activity.createdAt)}
                      </p>
                      <span className="text-[10px] text-gray-600 font-mono">
                        IP: {activity.ipAddress || "Internal"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="pb-10 text-white">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLogoutModal}
        title="Log Out From All Devices?"
        message="Are you sure you want to log out from all devices? This will immediately invalidate all active sessions and refresh tokens. You will be logged out from this device as well."
        confirmLabel="Confirm Logout"
        confirmVariant="danger"
        onConfirm={async () => {
          try {
            await axios.post("/auth/logout-all");
            logout();
            toast.success("Logged out from all devices successfully.");
          } catch (e) {
            toast.error("Failed to log out from all devices. Please try again.");
          } finally {
            setShowLogoutModal(false);
          }
        }}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Admin 2FA Security Policy Banner */}
      {["Super Admin", "Admin"].includes(user?.role) && !preferences.twoFactorEnabled && (
        <div className="mb-6 flex items-start gap-4 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300" role="alert">
          <div className="text-2xl shrink-0">⚠️</div>
          <div className="flex-1">
            <p className="font-bold text-amber-200 text-base mb-1">
              Security Policy Notice: Two-Factor Authentication Required for Admin Accounts
            </p>
            <p className="text-sm text-amber-300/80">
              Your account has <strong className="text-amber-200">Administrator</strong> privileges. The security policy requires all admin accounts to enable Two-Factor Authentication (2FA). Privileged actions will be restricted until 2FA is enabled.
            </p>
          </div>
          <button
            onClick={() => setActiveTab("security")}
            className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-lg transition"
          >
            Enable 2FA Now
          </button>
        </div>
      )}

      {/* Page Header */}
      <motion.div className="mb-8 px-2 pt-4 md:pt-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">Settings</h1>
        <p className="text-gray-400 text-xs md:text-sm font-medium mt-1">Manage your account, security, and preferences</p>
      </motion.div>

      {/* Tabs */}
      <motion.div className="bg-[#050505] rounded-xl border border-white/10 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex border-b border-white/10 overflow-x-auto scrollbar-hide no-scrollbar">
          {(Array.isArray(tabs) ? tabs : []).map((tab, idx) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-max py-3 md:py-4 px-4 md:px-6 border-b-2 transition text-xs md:text-sm font-medium flex items-center justify-center gap-2 focus:outline-none whitespace-nowrap ${activeTab === tab.id
                ? "text-white border-white bg-[#111]"
                : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-[#0a0a0a]"
                }`}
              variants={animationVariants.itemVariants}
              custom={idx}
            >
              <span>{tab.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-8 bg-[#000000]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={animationVariants.containerVariants}
            >
              {activeTab === "profile" && ProfileTab()}
              {activeTab === "security" && SecurityTab()}
              {activeTab === "preferences" && PreferencesTab()}
              {activeTab === "devices" && DevicesTab()}
              {activeTab === "activity" && ActivityTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

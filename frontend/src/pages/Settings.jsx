import React, { useState, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import { Button, Input, Card, Badge, PasswordStrengthMeter, Alert } from "../components/UI";
import { ProfessionalIcon, RoleBadge } from "../components/ProfessionalIcons";
import { getPasswordRequirements } from "../utils/validation";
import { animationVariants, transitionPresets } from "../utils/animations";
import { theme } from "../config/theme";

export default function Settings() {
  const { user, logout, refreshUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    department: "",
    avatar: "",
  });
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: true,
    activityNotifications: true,
    securityAlerts: true,
    theme: "dark",
    sessionTimeout: 30,
    twoFactorEnabled: user?.isTwoFactorEnabled || false,
  });

  const [tfaSetup, setTfaSetup] = useState({
    qrCode: null,
    secret: null,
    token: "",
    isSettingUp: false
  });

  // Sync state with user context (§Category 4)
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
        twoFactorEnabled: user.isTwoFactorEnabled || false,
      });
    }
  }, [user]);

  const updatePreferences = async (newPrefs) => {
    try {
      setLoading(true);
      await axios.put("/auth/profile", { preferences: newPrefs });
      setPreferences(prev => ({ ...prev, ...newPrefs }));
      await refreshUser();
      toast.success("Preferences synchronized successfully.");
    } catch (error) {
      toast.error("Failed to sync preferences.");
    } finally {
      setLoading(false);
    }
  };

  // Tabs Configuration
  const tabs = [
    { id: "profile", label: "Profile", icon: "user" },
    { id: "security", label: "Security", icon: "lock" },
    { id: "preferences", label: "Preferences", icon: "settings" },
    { id: "devices", label: "Sessions", icon: "smartphone" },
    { id: "activity", label: "Activity", icon: "activity" },
  ];


  // Tab Content Components
  const ProfileTab = () => (
    <motion.div
      className="space-y-6 max-w-2xl"
      initial="hidden"
      animate="visible"
      variants={animationVariants.containerVariants}
    >
      <motion.div variants={animationVariants.itemVariants}>
        <h2 className="text-xl font-medium text-white mb-6">
          User Profile
        </h2>

        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center gap-6">
            <motion.div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white bg-[#111] border border-white/10"
              whileHover={{ scale: 1.05 }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </motion.div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Name</p>
              <p className="text-xl font-semibold text-white">{user?.name}</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs font-semibold">Verified</span>
                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-xs font-semibold">{user?.role || "User"}</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            setLoading(true);
            await axios.put("/auth/profile", profileData);
            await refreshUser();
            toast.success("Profile updated successfully!", {
              position: "top-right",
              autoClose: 3000,
            });
          } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update profile");
          } finally {
            setLoading(false);
          }
        }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="user" size={16} />
                Full Name
              </div>
            </label>
            <input
              type="text"
              value={profileData.name}
              onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
              required
              className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white caret-white outline-none focus:border-white/30 transition-all font-medium"
              style={{ color: 'white' }}
            />
          </div>
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
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed for security reasons</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="smartphone" size={16} />
                Phone Number
              </div>
            </label>
            <input
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={profileData.phone}
              onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
              className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white caret-white outline-none focus:border-white/30 transition-all font-medium"
              style={{ color: 'white' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="building" size={16} />
                Department
              </div>
            </label>
            <input
              type="text"
              placeholder="IT Support"
              value={profileData.department}
              onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
              className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white caret-white outline-none focus:border-white/30 transition-all font-medium"
              style={{ color: 'white' }}
            />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading}
              className="w-full"
            >
              Save Changes
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </motion.div>
  );

  const SecurityTab = () => (
    <motion.div
      className="space-y-6 max-w-2xl"
      initial="hidden"
      animate="visible"
      variants={animationVariants.containerVariants}
    >
      <motion.div variants={animationVariants.itemVariants}>
        <h2 className="text-xl font-medium text-white mb-6">
          Security Settings
        </h2>

        {/* Change Password Section */}
        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0a]">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            Change Password
          </h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (passwordData.newPassword !== passwordData.confirmPassword) {
              toast.error("Passwords do not match");
              return;
            }
            try {
              setLoading(true);
              await axios.post("/auth/change-password", {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
              });
              await refreshUser();
              toast.success("Password changed successfully!");
              setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
            } catch (error) {
              toast.error(error.response?.data?.message || "Failed to change password");
            } finally {
              setLoading(false);
            }
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
                className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white caret-white outline-none focus:border-white/30 transition-all font-medium"
                style={{ color: 'white' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white caret-white outline-none focus:border-white/30 transition-all font-medium"
                style={{ color: 'white' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white caret-white outline-none focus:border-white/30 transition-all font-medium"
                style={{ color: 'white' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-2.5 rounded-lg font-medium hover:bg-gray-100 transition"
            >
              Update Password
            </button>
          </form>
        </div>

        {/* Two-Factor Authentication */}
        <div className="p-6 rounded-xl border border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                Two-Factor Authentication (2FA)
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                Add an extra layer of security to your account
              </p>
              {preferences.twoFactorEnabled && (
                <span className="inline-block mt-3 px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs font-semibold">
                  Enabled
                </span>
              )}
            </div>
            {!tfaSetup.isSettingUp && (
              <button
                className={`px-4 py-2 rounded-lg font-medium text-sm transition ${preferences.twoFactorEnabled
                  ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  : "bg-white text-black hover:bg-gray-100"
                  }`}
                onClick={async () => {
                  try {
                    if (preferences.twoFactorEnabled) {
                      await axios.post("/auth/2fa/disable");
                      setPreferences(prev => ({ ...prev, twoFactorEnabled: false }));
                      await refreshUser();
                      toast.success("2FA has been disabled.");
                    } else {
                      const res = await axios.post("/auth/2fa/generate");
                      setTfaSetup({ ...tfaSetup, qrCode: res.data.qrCode, secret: res.data.secret, isSettingUp: true });
                    }
                  } catch (e) {
                    toast.error("Failed to configure 2FA.");
                  }
                }}
              >
                {preferences.twoFactorEnabled ? "Disable" : "Enable"}
              </button>
            )}
          </div>

          {tfaSetup.isSettingUp && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <h4 className="text-white font-medium mb-3">Scan this QR Code</h4>
              <p className="text-sm text-gray-400 mb-4">Scan the image below with the Google Authenticator app or a similar time-based OTP app.</p>
              <div className="bg-white p-2 inline-block rounded-lg mb-4">
                <img src={tfaSetup.qrCode} alt="2FA QR Code" />
              </div>
              <div className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Enter Authentication Code
                  </label>
                  <input
                    type="text"
                    placeholder="000 000"
                    value={tfaSetup.token}
                    onChange={(e) => setTfaSetup({ ...tfaSetup, token: e.target.value })}
                    className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white caret-white outline-none focus:border-white/30 tracking-widest text-center text-xl font-mono"
                    style={{ color: 'white' }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTfaSetup({ ...tfaSetup, isSettingUp: false, token: "" })}
                    className="flex-1 px-4 py-2 rounded-lg font-medium text-sm text-gray-400 hover:text-white transition bg-white/5 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await axios.post("/auth/2fa/verify", { token: tfaSetup.token.replace(/\s/g, '') });
                        setPreferences(prev => ({ ...prev, twoFactorEnabled: true }));
                        setTfaSetup({ ...tfaSetup, isSettingUp: false, token: "" });
                        await refreshUser();
                        toast.success("Two-Factor Authentication successfully enabled!");

                      } catch (e) {
                        toast.error("Invalid authentication token.");
                      }
                    }}
                    className="flex-1 px-4 py-2 rounded-lg font-medium text-sm text-black bg-white hover:bg-gray-100 transition"
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

  const PreferencesTab = () => (
    <motion.div
      className="space-y-6 max-w-2xl"
      initial="hidden"
      animate="visible"
      variants={animationVariants.containerVariants}
    >
      <motion.div variants={animationVariants.itemVariants}>
        <h2 className="text-xl font-medium text-white mb-6">
          Notification Preferences
        </h2>

        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0a]">
          <div className="space-y-4">
            {[
              { key: "emailNotifications", label: "Email Notifications", description: "Receive updates via email", icon: "email" },
              { key: "pushNotifications", label: "Push Notifications", description: "Get real-time alerts", icon: "notification" },
              { key: "activityNotifications", label: "Activity Updates", description: "Stay informed about asset changes", icon: "activity" },
              { key: "securityAlerts", label: "Security Alerts", description: "Critical security notifications", icon: "alert" },
            ].map((pref) => (
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{
                    backgroundColor: preferences[pref.key] ? "#0ea5e9" : "#333"
                  }}
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
            <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
              🛡️ Privacy & Tracking Consent
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Manage what asset data is collected to address privacy concerns.
            </p>
            {[
              { key: "trackLocation", label: "Track General Location", description: "Allow tracking of asset department and building.", icon: "location" },
              { key: "trackIP", label: "Network Activity Monitoring", description: "Allow logging of IPs and MAC addresses for security.", icon: "activity" },
            ].map((pref) => (
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
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{
                    backgroundColor: preferences[pref.key] !== false ? "#0ea5e9" : "#333"
                  }}
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

  const DevicesTab = () => (
    <motion.div
      className="space-y-6 max-w-2xl"
      initial="hidden"
      animate="visible"
      variants={animationVariants.containerVariants}
    >
      <motion.div variants={animationVariants.itemVariants}>
        <h2 className="text-xl font-medium mb-6 text-white">
          Active Sessions
        </h2>

        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0a] relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500"></div>
          <div className="flex items-center justify-between pl-4">
            <div>
              <p className="font-bold text-white mb-2 flex items-center gap-2">
                <ProfessionalIcon name="desktop" size={18} /> Current Session
              </p>
              <div className="space-y-1 text-sm text-gray-400">
                <p className="flex items-center gap-2">Browser: Modern Browser</p>
                <p className="flex items-center gap-2">Last Active: Just Now</p>
              </div>
              <span className="inline-block mt-3 px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs font-semibold">
                Active Now
              </span>
            </div>
          </div>
        </div>

        <motion.div variants={animationVariants.itemVariants}>
          <button
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg py-3 font-semibold transition flex items-center justify-center gap-2"
            onClick={async () => {
              if (window.confirm("Are you sure you want to log out from all devices? This will invalidate all refresh tokens.")) {
                try {
                  await axios.post("/auth/logout-all");
                  logout();
                  toast.success("Logged out from all devices");
                } catch (e) {
                  toast.error("Error logging out of all devices");
                }
              }
            }}
          >
            Log Out From All Sessions
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );

  const ActivityTab = () => (
    <motion.div
      className="space-y-6 max-w-2xl"
      initial="hidden"
      animate="visible"
      variants={animationVariants.containerVariants}
    >
      <motion.div variants={animationVariants.itemVariants}>
        <h2 className="text-xl font-medium mb-6 text-white">
          Activity Timeline
        </h2>

        <div className="space-y-3">
          {[
            { icon: "lock", action: "Password Changed", time: user?.activityTimestamps?.passwordChangedAt ? new Date(user.activityTimestamps.passwordChangedAt).toLocaleString() : "Never", status: user?.activityTimestamps?.passwordChangedAt ? "success" : "info" },
            { icon: "user", action: "Profile Updated", time: user?.activityTimestamps?.profileUpdatedAt ? new Date(user.activityTimestamps.profileUpdatedAt).toLocaleString() : "Never", status: user?.activityTimestamps?.profileUpdatedAt ? "info" : "neutral" },
            { icon: "shield", action: "2FA Checked", time: user?.activityTimestamps?.tfaEnabledAt ? new Date(user.activityTimestamps.tfaEnabledAt).toLocaleString() : "Never", status: user?.activityTimestamps?.tfaEnabledAt ? "success" : "neutral" },
          ].map((activity, idx) => (

            <motion.div
              key={idx}
              className="flex gap-4 p-4 rounded-xl border border-white/10 bg-[#0a0a0a] hover:bg-white/5 transition"
              variants={animationVariants.itemVariants}
            >
              <div className="text-cyan-400 mt-1">
                <ProfessionalIcon name={activity.icon} size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">{activity.action}</p>
                <p className="text-sm text-gray-400">{activity.time}</p>
              </div>
              <div>
                <span className={`px-2 py-1 text-xs rounded border ${activity.status === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                  {activity.status === "success" ? "Done" : "Info"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="pb-10 text-white">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* ── Admin 2FA Security Policy Banner ──────────────────────────────── */}
      {["Super Admin", "Admin"].includes(user?.role) && !preferences.twoFactorEnabled && (
        <div
          className="mb-6 flex items-start gap-4 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300"
          role="alert"
        >
          <div className="text-2xl shrink-0">⚠️</div>
          <div className="flex-1">
            <p className="font-bold text-amber-200 text-base mb-1">
              Security Policy Violation — 2FA Required for Administrators
            </p>
            <p className="text-sm text-amber-300/80">
              Your account has <strong>Administrator</strong> privileges. The enterprise security
              policy mandates Two-Factor Authentication (2FA) for all admin accounts.
              You will be blocked from performing privileged actions until 2FA is enabled.
            </p>
          </div>
          <button
            onClick={() => setActiveTab("security")}
            className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-lg transition"
          >
            Enable 2FA Now →
          </button>
        </div>
      )}

      {/* Page Header */}
      <motion.div
        className="mb-8 px-2 pt-4 md:pt-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-gray-400 text-xs md:text-sm font-medium mt-1">Manage your account, security, and preferences</p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        className="bg-[#050505] rounded-xl border border-white/10 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex border-b border-white/10 overflow-x-auto scrollbar-hide no-scrollbar">
          {tabs.map((tab, idx) => (
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

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
  const { user, logout } = useContext(AuthContext);
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="user" size={16} />
                Full Name
              </div>
            </label>
            <Input
              value={profileData.name}
              onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="email" size={16} />
                Email Address
              </div>
            </label>
            <Input
              type="email"
              value={profileData.email}
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed for security reasons</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="smartphone" size={16} />
                Phone Number
              </div>
            </label>
            <Input
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={profileData.phone}
              onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <ProfessionalIcon name="building" size={16} />
                Department
              </div>
            </label>
            <Input
              placeholder="IT Support"
              value={profileData.department}
              onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
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
                className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-white/30"
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
                className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-white/30"
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
                className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-white/30"
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
                    className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-white/30 tracking-widest text-center text-xl font-mono"
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
        <h2
          className="text-2xl font-bold mb-6"
          style={{ color: theme.colors.primary[700] }}
        >
          Notification Preferences
        </h2>

        <Card>
          <div className="space-y-4">
            {[
              { key: "emailNotifications", label: "Email Notifications", description: "Receive updates via email", icon: "email" },
              { key: "pushNotifications", label: "Push Notifications", description: "Get real-time alerts", icon: "bell" },
              { key: "activityNotifications", label: "Activity Updates", description: "Stay informed about asset changes", icon: "activity" },
              { key: "securityAlerts", label: "Security Alerts", description: "Critical security notifications", icon: "alert" },
            ].map((pref) => (
              <motion.div
                key={pref.key}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                variants={animationVariants.itemVariants}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <ProfessionalIcon name={pref.icon} size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{pref.label}</p>
                    <p className="text-sm text-gray-600">{pref.description}</p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={() => setPreferences(prev => ({ ...prev, [pref.key]: !prev[pref.key] }))}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors`}
                  style={{
                    backgroundColor: preferences[pref.key] ? theme.colors.secondary[500] : "#d1d5db"
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  <motion.span
                    className="inline-block h-6 w-6 transform rounded-full bg-white shadow-lg"
                    animate={{ x: preferences[pref.key] ? 28 : 2 }}
                    transition={transitionPresets.snappy}
                  />
                </motion.button>
              </motion.div>
            ))}
          </div>
        </Card>
        <Card className="mt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              🛡️ Privacy & Tracking Consent
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Manage what asset data is collected to address privacy concerns.
            </p>
            {[
              { key: "trackLocation", label: "Track General Location", description: "Allow tracking of asset department and building.", icon: "location" },
              { key: "trackIP", label: "Network Activity Monitoring", description: "Allow logging of IPs and MAC addresses for security.", icon: "activity" },
            ].map((pref) => (
              <motion.div
                key={pref.key}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                variants={animationVariants.itemVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <ProfessionalIcon name={pref.icon} size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{pref.label}</p>
                    <p className="text-sm text-gray-600">{pref.description}</p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={() => setPreferences(prev => ({ ...prev, [pref.key]: prev[pref.key] === undefined ? false : !prev[pref.key] }))}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors`}
                  style={{
                    backgroundColor: preferences[pref.key] !== false ? theme.colors.secondary[500] : "#d1d5db"
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  <motion.span
                    className="inline-block h-6 w-6 transform rounded-full bg-white shadow-lg"
                    animate={{ x: preferences[pref.key] !== false ? 28 : 2 }}
                    transition={transitionPresets.snappy}
                  />
                </motion.button>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card className="mt-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ProfessionalIcon name="palette" size={20} /> Theme
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {["light", "dark"].map((themeOption) => (
              <motion.button
                key={themeOption}
                type="button"
                onClick={() => setPreferences(prev => ({ ...prev, theme: themeOption }))}
                className={`p-4 rounded-lg border-2 transition ${preferences.theme === themeOption
                  ? "bg-opacity-10"
                  : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                style={{
                  borderColor: preferences.theme === themeOption ? theme.colors.primary[600] : undefined,
                  backgroundColor: preferences.theme === themeOption ? `${theme.colors.primary[50]}` : undefined
                }}
                variants={animationVariants.itemVariants}
              >
                <div className="text-2xl block mb-2">
                  {themeOption === "light" ?
                    <ProfessionalIcon name="sun" size={20} /> :
                    <ProfessionalIcon name="moon" size={20} />
                  }
                </div>
                <span className="font-semibold text-gray-800 capitalize">{themeOption}</span>
              </motion.button>
            ))}
          </div>
        </Card>
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
        <h2
          className="text-2xl font-bold mb-6 flex items-center gap-2"
          style={{ color: theme.colors.primary[700] }}
        >
          <ProfessionalIcon name="link" size={24} /> Active Sessions
        </h2>

        <Card className="mb-4" style={{
          borderLeft: `4px solid ${theme.colors.secondary[500]}`
        }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <ProfessionalIcon name="monitor" size={18} /> Current Session
              </p>
              <div className="space-y-1 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <ProfessionalIcon name="globe" size={16} /> Browser: Chrome (Windows)
                </p>
                <p className="flex items-center gap-2">
                  <ProfessionalIcon name="location" size={16} /> Location: Your Location
                </p>
                <p className="flex items-center gap-2">
                  <ProfessionalIcon name="clock" size={16} /> Last Active: Just Now
                </p>
              </div>
              <Badge variant="success" className="mt-3">
                Active Now
              </Badge>
            </div>
            <ProfessionalIcon name="check" size={40} />
          </div>
        </Card>

        <motion.div variants={animationVariants.itemVariants}>
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            onClick={() => {
              if (window.confirm("Logout from all devices?")) {
                logout();
                toast.success("Logged out from all devices");
              }
            }}
          >
            <ProfessionalIcon name="logout" size={18} style={{ marginRight: '8px' }} />
            Logout from All Sessions
          </Button>
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
        <h2
          className="text-2xl font-bold mb-6 flex items-center gap-2"
          style={{ color: theme.colors.primary[700] }}
        >
          <ProfessionalIcon name="activity" size={24} /> Activity Timeline
        </h2>

        <div className="space-y-3">
          {[
            { icon: "lock", action: "Password Changed", time: "2 hours ago", status: "success" },
            { icon: "login", action: "New Login", time: "Today at 10:30 AM", status: "info" },
            { icon: "user", action: "Profile Updated", time: "Yesterday", status: "info" },
            { icon: "shield", action: "2FA Enabled", time: "3 days ago", status: "success" },
          ].map((activity, idx) => (
            <motion.div
              key={idx}
              className="flex gap-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              variants={animationVariants.itemVariants}
            >
              <div className="mt-1">
                <ProfessionalIcon name={activity.icon} size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{activity.action}</p>
                <p className="text-sm text-gray-500">{activity.time}</p>
              </div>
              <Badge variant={activity.status} size="sm">
                {activity.status === "success" ? <ProfessionalIcon name="check" size={14} /> : "ℹ"}
              </Badge>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="pb-10 text-white">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      {/* Page Header */}
      <motion.div
        className="mb-8 px-2 pt-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-gray-400 text-sm font-medium mt-1">Manage your account, security, and preferences</p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        className="bg-[#050505] rounded-xl border border-white/10 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex border-b border-white/10 overflow-x-auto">
          {tabs.map((tab, idx) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-max py-4 px-6 border-b-2 transition text-sm font-medium flex items-center justify-center gap-2 focus:outline-none ${activeTab === tab.id
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
        <div className="p-8 bg-[#000000]">
          <AnimatePresence mode="wait">
            {activeTab === "profile" && <ProfileTab key="profile" />}
            {activeTab === "security" && <SecurityTab key="security" />}
            {activeTab === "preferences" && <PreferencesTab key="preferences" />}
            {activeTab === "devices" && <DevicesTab key="devices" />}
            {activeTab === "activity" && <ActivityTab key="activity" />}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

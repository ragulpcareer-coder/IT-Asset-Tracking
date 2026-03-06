import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { socket } from "../services/socket";

/**
 * SecurityAlertBanner — Real-Time Live Security Alert Panel
 * Listens to socket "security_alert" events and shows a sliding
 * notification panel. Holds up to 5 most recent alerts.
 * Auto-dismisses each alert after 8 seconds.
 */

const ALERT_ICONS = {
    FAILED_LOGIN: "🔐",
    ACCOUNT_LOCKED: "🔒",
    ADMIN_PROMOTED: "⭐",
    NEW_DEVICE_LOGIN: "📱",
    BRUTE_FORCE_DETECTED: "🚨",
    PRIVILEGE_ESCALATION_ALERT: "⚠️",
    OFF_HOURS_LOGIN: "🌙",
    ASSET_HIGH_RISK: "🔴",
    DEFAULT: "⚠️",
};

const ALERT_COLORS = {
    FAILED_LOGIN: "border-yellow-500/40 bg-yellow-500/10",
    ACCOUNT_LOCKED: "border-red-500/40 bg-red-500/10",
    ADMIN_PROMOTED: "border-blue-500/40 bg-blue-500/10",
    NEW_DEVICE_LOGIN: "border-cyan-500/40 bg-cyan-500/10",
    BRUTE_FORCE_DETECTED: "border-red-600/50 bg-red-600/20",
    PRIVILEGE_ESCALATION_ALERT: "border-orange-500/40 bg-orange-500/10",
    OFF_HOURS_LOGIN: "border-purple-500/40 bg-purple-500/10",
    DEFAULT: "border-white/20 bg-white/5",
};

export default function SecurityAlertBanner() {
    const [alerts, setAlerts] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);

    const addAlert = useCallback((alert) => {
        const id = Date.now() + Math.random();
        const newAlert = { ...alert, id, timestamp: new Date() };
        setAlerts((prev) => [newAlert, ...prev].slice(0, 5));

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
            setAlerts((prev) => prev.filter((a) => a.id !== id));
        }, 8000);
    }, []);

    useEffect(() => {
        socket.on("security_alert", addAlert);
        return () => socket.off("security_alert", addAlert);
    }, [addAlert]);

    if (alerts.length === 0) return null;

    const icon = (type) => ALERT_ICONS[type] || ALERT_ICONS.DEFAULT;
    const color = (type) => ALERT_COLORS[type] || ALERT_COLORS.DEFAULT;
    const timeAgo = (date) => {
        const s = Math.floor((Date.now() - date) / 1000);
        if (s < 5) return "Just now";
        if (s < 60) return `${s}s ago`;
        return `${Math.floor(s / 60)}m ago`;
    };

    const visibleAlerts = isExpanded ? alerts : alerts.slice(0, 1);

    return (
        <div className="fixed bottom-5 right-5 z-[200] w-80 space-y-2 pointer-events-none">
            <AnimatePresence>
                {visibleAlerts.map((alert, i) => (
                    <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: 60, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 60, scale: 0.92 }}
                        transition={{ duration: 0.25, delay: i * 0.05 }}
                        className={`pointer-events-auto rounded-xl border p-4 shadow-2xl backdrop-blur-md ${color(alert.type)}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <span className="text-xl shrink-0 mt-0.5">{icon(alert.type)}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-xs uppercase tracking-wider mb-1">
                                        {(alert.type || "SECURITY ALERT").replace(/_/g, " ")}
                                    </p>
                                    <p className="text-gray-300 text-xs leading-relaxed truncate">
                                        {alert.message || "A security event was detected."}
                                    </p>
                                    {alert.ip && (
                                        <p className="text-gray-500 text-[10px] mt-1 font-mono">
                                            IP: {alert.ip}
                                        </p>
                                    )}
                                    <p className="text-gray-600 text-[10px] mt-0.5">
                                        {timeAgo(alert.timestamp)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                                className="text-gray-500 hover:text-white transition text-lg leading-none shrink-0"
                            >
                                ×
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Expand / collapse toggle when there are multiple alerts */}
            {alerts.length > 1 && (
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setIsExpanded((p) => !p)}
                    className="pointer-events-auto w-full text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition py-1"
                >
                    {isExpanded ? "Show Less ▲" : `+${alerts.length - 1} More Alert${alerts.length > 2 ? "s" : ""} ▼`}
                </motion.button>
            )}
        </div>
    );
}

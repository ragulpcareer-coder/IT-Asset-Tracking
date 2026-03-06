import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { socket } from "../services/socket";

/**
 * SecurityAlertBanner — Real-Time Live Security Alert Panel
 *
 * Renders two layers:
 *  1. HIGH_RISK_ALERT (severity: "critical") — full-width top bar, pulsing red,
 *     does NOT auto-dismiss. Requires manual close. Displays all 3 met conditions
 *     and the recommended action.
 *
 *  2. All other alerts — bottom-right sliding card panel.
 *     Auto-dismisses after 8 seconds. Holds up to 5 alerts.
 */

const ALERT_ICONS = {
    FAILED_LOGIN: "🔐",
    ACCOUNT_LOCKED: "🔒",
    ADMIN_PROMOTED: "⭐",
    NEW_DEVICE_LOGIN: "📱",
    BRUTE_FORCE_DETECTED: "🚨",
    PRIVILEGE_ESCALATION_ALERT: "⚠️",
    OFF_HOURS_LOGIN: "🌙",
    HIGH_RISK_ALERT: "🚨",
    DEFAULT: "⚠️",
};

const CARD_COLORS = {
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
    // Critical full-banner alerts (HIGH_RISK_ALERT)
    const [criticalAlerts, setCriticalAlerts] = useState([]);
    // Regular card-style alerts
    const [cardAlerts, setCardAlerts] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);

    const addAlert = useCallback((alert) => {
        const id = Date.now() + Math.random();
        const enriched = { ...alert, id, timestamp: new Date() };

        if (alert.type === "HIGH_RISK_ALERT" || alert.severity === "critical") {
            // Critical alerts stay until manually dismissed
            setCriticalAlerts((prev) => [enriched, ...prev].slice(0, 3));
        } else {
            setCardAlerts((prev) => [enriched, ...prev].slice(0, 5));
            // Auto-dismiss regular alerts after 8 seconds
            setTimeout(() => {
                setCardAlerts((prev) => prev.filter((a) => a.id !== id));
            }, 8000);
        }
    }, []);

    useEffect(() => {
        socket.on("security_alert", addAlert);
        return () => socket.off("security_alert", addAlert);
    }, [addAlert]);

    const timeAgo = (date) => {
        const s = Math.floor((Date.now() - date) / 1000);
        if (s < 5) return "Just now";
        if (s < 60) return `${s}s ago`;
        return `${Math.floor(s / 60)}m ago`;
    };

    const dismissCritical = (id) =>
        setCriticalAlerts((prev) => prev.filter((a) => a.id !== id));
    const dismissCard = (id) =>
        setCardAlerts((prev) => prev.filter((a) => a.id !== id));

    return (
        <>
            {/* ── CRITICAL HIGH RISK ALERTS — Full-width top banner ─────────── */}
            <AnimatePresence>
                {criticalAlerts.map((alert) => (
                    <motion.div
                        key={alert.id}
                        initial={{ y: -80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -80, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="fixed top-0 left-0 right-0 z-[500] bg-red-900 border-b-2 border-red-500 shadow-2xl"
                    >
                        {/* Pulsing red glow line */}
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 animate-pulse" />

                        <div className="max-w-7xl mx-auto px-4 py-3">
                            <div className="flex items-start gap-4">
                                {/* Blinking icon */}
                                <span className="text-2xl mt-0.5 animate-pulse shrink-0">🚨</span>

                                <div className="flex-1 min-w-0">
                                    {/* Title row */}
                                    <div className="flex items-center gap-3 flex-wrap mb-1">
                                        <span className="text-red-200 font-black text-sm uppercase tracking-widest">
                                            HIGH RISK ALERT
                                        </span>
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                            CRITICAL
                                        </span>
                                        <span className="text-red-400 text-xs">{timeAgo(alert.timestamp)}</span>
                                    </div>

                                    {/* Main message */}
                                    <p className="text-white font-semibold text-sm leading-snug mb-2">
                                        {alert.message}
                                    </p>

                                    {/* Conditions met — show exactly what triggered this */}
                                    {alert.conditions && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {alert.conditions.privilegedAccount && (
                                                <span className="text-[10px] bg-red-800/60 text-red-200 px-2 py-0.5 rounded border border-red-700/50 font-mono">
                                                    ⭐ Privileged Account ({alert.role})
                                                </span>
                                            )}
                                            {alert.conditions.priorFailedLogins > 0 && (
                                                <span className="text-[10px] bg-red-800/60 text-red-200 px-2 py-0.5 rounded border border-red-700/50 font-mono">
                                                    🔐 {alert.conditions.priorFailedLogins} Prior Failed Login{alert.conditions.priorFailedLogins > 1 ? "s" : ""}
                                                </span>
                                            )}
                                            {alert.conditions.newDevice && (
                                                <span className="text-[10px] bg-red-800/60 text-red-200 px-2 py-0.5 rounded border border-red-700/50 font-mono">
                                                    📱 Unrecognized Device
                                                </span>
                                            )}
                                            {alert.ip && (
                                                <span className="text-[10px] bg-red-800/60 text-red-300 px-2 py-0.5 rounded border border-red-700/50 font-mono">
                                                    IP: {alert.ip}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Recommended action */}
                                    {alert.recommendedAction && (
                                        <p className="text-red-300 text-xs italic">
                                            ⚡ {alert.recommendedAction}
                                        </p>
                                    )}
                                </div>

                                {/* Dismiss — requires intentional click */}
                                <button
                                    onClick={() => dismissCritical(alert.id)}
                                    className="shrink-0 text-red-300 hover:text-white text-xs font-bold border border-red-700 hover:border-red-400 px-3 py-1.5 rounded transition mt-0.5"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* ── REGULAR CARD ALERTS — bottom-right sliding panel ──────────── */}
            <div className="fixed bottom-5 right-5 z-[200] w-80 space-y-2 pointer-events-none">
                <AnimatePresence>
                    {(isExpanded ? cardAlerts : cardAlerts.slice(0, 1)).map((alert, i) => (
                        <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, x: 60, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 60, scale: 0.92 }}
                            transition={{ duration: 0.25, delay: i * 0.05 }}
                            className={`pointer-events-auto rounded-xl border p-4 shadow-2xl backdrop-blur-md
                ${CARD_COLORS[alert.type] || CARD_COLORS.DEFAULT}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <span className="text-xl shrink-0 mt-0.5">
                                        {ALERT_ICONS[alert.type] || ALERT_ICONS.DEFAULT}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold text-xs uppercase tracking-wider mb-1">
                                            {(alert.type || "SECURITY ALERT").replace(/_/g, " ")}
                                        </p>
                                        <p className="text-gray-300 text-xs leading-relaxed">
                                            {alert.message || "A security event was detected."}
                                        </p>
                                        {alert.ip && (
                                            <p className="text-gray-500 text-[10px] mt-1 font-mono">IP: {alert.ip}</p>
                                        )}
                                        <p className="text-gray-600 text-[10px] mt-0.5">{timeAgo(alert.timestamp)}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => dismissCard(alert.id)}
                                    className="text-gray-500 hover:text-white transition text-lg leading-none shrink-0"
                                >
                                    ×
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {cardAlerts.length > 1 && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => setIsExpanded((p) => !p)}
                        className="pointer-events-auto w-full text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition py-1"
                    >
                        {isExpanded
                            ? "Show Less ▲"
                            : `+${cardAlerts.length - 1} More Alert${cardAlerts.length > 2 ? "s" : ""} ▼`}
                    </motion.button>
                )}
            </div>
        </>
    );
}

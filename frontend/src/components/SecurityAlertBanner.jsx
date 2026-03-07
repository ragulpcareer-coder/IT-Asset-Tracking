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
    BRUTE_FORCE: "🚨",
    PRIVILEGE_ESCALATION_ALERT: "⚠️",
    UNUSUAL_LOGIN_TIME: "🌙",
    NEW_DEVICE_ADMIN: "🚨",
    ZERO_TRUST_VIOLATION: "🛡️",
    AI_FLAGGED_ANOMALY: "✧",
    DEFAULT: "⚠️",
};

const CARD_COLORS = {
    FAILED_LOGIN: "border-yellow-500/40 bg-slate-900",
    ACCOUNT_LOCKED: "border-red-500/40 bg-slate-900",
    BRUTE_FORCE: "border-red-600/50 bg-red-950/40",
    NEW_DEVICE_ADMIN: "border-orange-500/40 bg-slate-900",
    ZERO_TRUST_VIOLATION: "border-emerald-500/40 bg-slate-900",
    AI_FLAGGED_ANOMALY: "border-cyan-500/40 bg-slate-900",
    DEFAULT: "border-white/20 bg-slate-900/80",
};

export default function SecurityAlertBanner() {
    // Critical full-banner alerts
    const [criticalAlerts, setCriticalAlerts] = useState([]);
    // Regular card-style alerts
    const [cardAlerts, setCardAlerts] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);

    const addAlert = useCallback((alert) => {
        const id = alert._id || (Date.now() + Math.random());
        const enriched = {
            ...alert,
            id,
            timestamp: alert.createdAt || new Date(),
            message: alert.description || alert.message || "Security event detected."
        };

        if (alert.severity === "CRITICAL" || alert.severity === "critical") {
            setCriticalAlerts((prev) => [enriched, ...prev.filter(a => a.id !== id)].slice(0, 3));
        } else {
            setCardAlerts((prev) => [enriched, ...prev.filter(a => a.id !== id)].slice(0, 5));
            setTimeout(() => {
                setCardAlerts((prev) => prev.filter((a) => a.id !== id));
            }, 10000);
        }
    }, []);

    useEffect(() => {
        socket.on("security_alert", addAlert);
        return () => socket.off("security_alert", addAlert);
    }, [addAlert]);

    const timeAgo = (date) => {
        const s = Math.floor((Date.now() - new Date(date)) / 1000);
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
            {/* ── CRITICAL ALERTS — Top Banner ─────────── */}
            <AnimatePresence>
                {criticalAlerts.map((alert) => (
                    <motion.div
                        key={alert.id}
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        className="fixed top-0 left-0 right-0 z-[500] bg-red-950 border-b-2 border-red-500 shadow-2xl"
                    >
                        <div className="max-w-7xl mx-auto px-6 py-4">
                            <div className="flex items-center gap-6">
                                <span className="text-3xl animate-pulse shrink-0">🚨</span>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="text-red-500 font-black text-xs uppercase tracking-[0.2em]">SOC CRITICAL ALERT</span>
                                        <span className="text-slate-500 text-[10px] font-mono">{timeAgo(alert.timestamp)}</span>
                                    </div>
                                    <p className="text-white font-bold text-base leading-tight">
                                        {alert.message}
                                    </p>
                                    <div className="mt-2 flex gap-3">
                                        <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded border border-red-500/30 font-mono">
                                            IP: {alert.sourceIp || alert.ip}
                                        </span>
                                        {alert.type && (
                                            <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded border border-white/10 font-mono">
                                                TYPE: {alert.type}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => dismissCritical(alert.id)}
                                    className="px-4 py-2 border border-red-500/50 text-red-500 text-xs font-black uppercase hover:bg-red-500 hover:text-white transition"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* ── CARD ALERTS — Bottom-Right ──────────── */}
            <div className="fixed bottom-8 right-8 z-[200] w-80 space-y-3 pointer-events-none">
                <AnimatePresence>
                    {(isExpanded ? cardAlerts : cardAlerts.slice(0, 1)).map((alert, i) => (
                        <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={`pointer-events-auto rounded-xl border p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden ${CARD_COLORS[alert.type] || CARD_COLORS.DEFAULT}`}
                        >
                            {/* Decorative accent */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${alert.severity === 'HIGH' ? 'bg-orange-500' : 'bg-blue-500'}`} />

                            <div className="flex items-start gap-4">
                                <span className="text-2xl mt-1 shrink-0">
                                    {ALERT_ICONS[alert.type] || ALERT_ICONS.DEFAULT}
                                </span>
                                <div className="flex-1">
                                    <h4 className="text-white font-black text-[10px] uppercase tracking-widest mb-1.5 opacity-70">
                                        {alert.type?.replace(/_/g, " ")}
                                    </h4>
                                    <p className="text-slate-200 text-xs font-medium leading-relaxed">
                                        {alert.message}
                                    </p>
                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="text-[9px] font-mono text-slate-500">
                                            {alert.sourceIp || alert.ip || "0.0.0.0"}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-600 uppercase">
                                            {timeAgo(alert.timestamp)}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => dismissCard(alert.id)} className="text-slate-500 hover:text-white transition text-sm font-black">
                                    ✕
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {cardAlerts.length > 1 && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="pointer-events-auto w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition"
                    >
                        {isExpanded ? "Show Less ▲" : `+${cardAlerts.length - 1} More Activity ▼`}
                    </button>
                )}
            </div>
        </>
    );
}
        </>
    );
}

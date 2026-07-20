import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosConfig";
import { toast } from "react-toastify";

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const dialogRef = React.useRef(null);
    const searchInputRef = React.useRef(null);

    // Listen for Cmd+K or Ctrl+K and custom event
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };
        const handleOpen = () => setIsOpen(true);

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("open-command-palette", handleOpen);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("open-command-palette", handleOpen);
        };
    }, []);

    // Fetch results when search changes
    useEffect(() => {
        if (!search.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        let isActive = true;

        const fetchResults = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`/assets?search=${encodeURIComponent(search)}&limit=5`, {
                    signal: controller.signal,
                });
                if (!isActive) return;
                setResults(Array.isArray(res.data?.assets) ? res.data.assets : []);
            } catch (err) {
                if (err?.name === "CanceledError" || err?.name === "AbortError") return;
                if (!isActive) return;
                setResults([]);
                toast.error("We couldn't load search results right now.", { toastId: "command-palette-search-error" });
            } finally {
                if (isActive) setLoading(false);
            }
        };

        const debounce = setTimeout(fetchResults, 300);
        return () => {
            isActive = false;
            clearTimeout(debounce);
            controller.abort();
        };
    }, [search]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const previousActive = document.activeElement;
        searchInputRef.current?.focus();

        const handleKeyDown = (event) => {
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = Array.from(
                dialogRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            previousActive?.focus?.();
        };
    }, [isOpen]);

    const handleSelect = (asset) => {
        setIsOpen(false);
        navigate("/assets");
        // Ideally, we'd highlight or open the specific asset, but navigating there is a good start
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-black/60"
                    onClick={() => setIsOpen(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Command palette"
                        ref={dialogRef}
                    >
                        <div className="flex items-center px-4 py-3 border-b border-white/10 bg-[#111]">
                            <span className="text-xl mr-3 opacity-50">🔍</span>
                            <input
                                autoFocus
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search assets or commands... (e.g. 'Laptop')"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-transparent text-white text-lg outline-none placeholder-gray-500"
                            />
                            <div className="flex gap-1 ml-3">
                                <kbd className="bg-white/10 px-2 py-1 rounded text-xs font-mono text-gray-400">ESC</kbd>
                            </div>
                        </div>

                        <div className="max-h-[50vh] overflow-y-auto p-2 scrollbar-hide">
                            {loading && <div className="p-4 text-center text-gray-500">Searching...</div>}

                            {!loading && results.length > 0 && (
                                <div className="space-y-1 mt-2">
                                    <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Assets</div>
                                    {Array.isArray(results) && results.map((asset) => (
                                        <button
                                            key={asset._id}
                                            onClick={() => handleSelect(asset)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#1a1a1a] transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-[#222] border border-white/5 flex items-center justify-center text-gray-400">
                                                    📦
                                                </div>
                                                <div>
                                                    <div className="text-gray-200 font-medium group-hover:text-white transition-colors">{asset.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{asset.serialNumber}</div>
                                                </div>
                                            </div>
                                            <span className="text-xs px-2 py-1 rounded bg-[#222] border border-white/5 text-gray-400">
                                                {asset.status}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {!loading && !search && (
                                <div className="space-y-1 mt-2">
                                    <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Quick Commands</div>
                                    {[
                                        { label: "Go to Dashboard", path: "/" },
                                        { label: "Manage Assets", path: "/assets" },
                                        { label: "View Audit Logs", path: "/audit-logs" },
                                        { label: "System Settings", path: "/settings" },
                                    ].map((cmd) => (
                                        <button
                                            key={cmd.path}
                                            onClick={() => {
                                                setIsOpen(false);
                                                navigate(cmd.path);
                                            }}
                                            className="w-full flex items-center p-3 rounded-xl hover:bg-[#1a1a1a] transition-all text-left text-gray-300 group"
                                        >
                                            <span className="text-gray-500 mr-3 group-hover:text-white transition-colors">⚡</span>
                                            {cmd.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {!loading && search && results.length === 0 && (
                                <div className="p-8 text-center text-gray-500">
                                    No assets found
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

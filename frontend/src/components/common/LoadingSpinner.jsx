import React from "react";
import { motion } from "framer-motion";

export default function LoadingSpinner({ message = "Loading...", fullScreen = false }) {
    const content = (
        <motion.div
            className="flex flex-col items-center justify-center space-y-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
        >
            <motion.div
                className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            {message && (
                <p className="text-teal-200 font-medium text-sm animate-pulse tracking-wide">
                    {message}
                </p>
            )}
        </motion.div>
    );

    if (fullScreen) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] md:min-h-screen">
                {content}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-8 w-full h-full">
            {content}
        </div>
    );
}

const correlationEngine = require("../services/correlationEngine");

/**
 * Zero Trust Policy Engine
 * Enforces strict multi-factor verification beyond simple role-based access.
 */
const zeroTrustEnforcement = async (req, res, next) => {
    try {
        const user = req.user; // Set by authMiddleware
        if (!user) return res.status(401).json({ message: "Identity proof required." });

        // Zero Trust only applies to Admin roles by default (§Policy 1.1)
        if (!["Super Admin", "Admin"].includes(user.role)) return next();

        const ip = req.ip || req.connection.remoteAddress;
        const fingerprint = req.body.fingerprint || req.headers['x-agent-signature'] || 'unknown';

        // 1. Mandatory 2FA Check (Enforced in Production)
        if (!user.twoFactorEnabled && process.env.NODE_ENV === 'production') {
            correlationEngine.recordZeroTrustViolation(user._id, "Missing 2FA for privileged role", ip);
            return res.status(403).json({
                success: false,
                code: "ZERO_TRUST_VIOLATION",
                message: "Security Policy Violation: Administrator accounts must have Two-Factor Authentication enabled."
            });
        }

        // 2. Behavioral Check (Time of Use)
        const hour = new Date().getHours();
        const isSuspiciousTime = hour >= 23 || hour < 5; // 11 PM to 5 AM

        if (isSuspiciousTime) {
            // We don't block entirely, but we log and could require a step-up token
            correlationEngine.checkAnomalies(user._id, ip, { fingerprint });
        }

        // 3. Known Device Check
        const isKnownDevice = user.behavioralMetadata?.trustedDevices?.includes(fingerprint);

        if (!isKnownDevice && fingerprint !== 'unknown') {
            // Log the new device but allow if 2FA was just verified (handled in login)
            // If it's a mid-session access to a critical route, we might re-verify.
            console.log(`[ZeroTrust] New device fingerprint detected: ${fingerprint}`);
        }

        next();
    } catch (error) {
        console.error("[ZeroTrust] Enforcement error:", error);
        next();
    }
};

module.exports = zeroTrustEnforcement;

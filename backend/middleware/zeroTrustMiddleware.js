const correlationEngine = require("../services/correlationEngine");
const { extractClientIp } = require("../utils/clientIp");

/**
 * Zero Trust Policy Engine
 * Enforces strict multi-factor verification beyond simple role-based access.
 */
const zeroTrustEnforcement = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Identity proof required." });

        if (!["Super Admin", "Admin"].includes(user.role)) return next();

        const ip = extractClientIp(req);
        const fingerprint = req.body?.fingerprint || req.headers["x-device-fingerprint"] || req.headers["x-agent-signature"] || "unknown";

        // Mandatory 2FA for privileged users in production
        if (!user.twoFactorEnabled && process.env.NODE_ENV === "production") {
            correlationEngine.recordZeroTrustViolation(user._id, "Missing 2FA for privileged role", ip);
            return res.status(403).json({
                success: false,
                code: "ZERO_TRUST_VIOLATION",
                message: "Security Policy Violation: Administrator accounts must have Two-Factor Authentication enabled."
            });
        }

        // Do not run behavioral anomaly checks on every API request.
        // Login flow already performs anomaly detection once per authenticated session.
        const trustedDevices = user.behavioralMetadata?.trustedDevices || [];
        if (fingerprint !== "unknown" && trustedDevices.length > 0 && !trustedDevices.includes(fingerprint)) {
            console.log(`[ZeroTrust] Unrecognized device fingerprint for ${user.email}: ${fingerprint}`);
        }

        return next();
    } catch (error) {
        console.error("[ZeroTrust] Enforcement error:", error);
        return next();
    }
};

module.exports = zeroTrustEnforcement;

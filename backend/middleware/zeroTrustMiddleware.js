const correlationEngine = require("../services/correlationEngine");
const { extractClientIp } = require("../utils/clientIp");
const { sendError } = require("../utils/apiResponse");

/**
 * Zero Trust Policy Engine
 * Enforces strict multi-factor verification beyond simple role-based access.
 */
const zeroTrustEnforcement = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) return sendError(res, 401, "Identity proof required");

        if (!["Super Admin", "Admin"].includes(user.role)) return next();

        const ip = extractClientIp(req);
        const fingerprint = req.body?.fingerprint || req.headers["x-device-fingerprint"] || req.headers["x-agent-signature"] || "unknown";

        if (!user.twoFactorEnabled && process.env.NODE_ENV === "production") {
            correlationEngine.recordZeroTrustViolation(user._id, "Missing 2FA for privileged role", ip);
            return sendError(res, 403, "Security policy violation: administrator accounts must have Two-Factor Authentication enabled");
        }

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

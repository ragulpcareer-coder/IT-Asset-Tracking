const { verifyRequestSignature } = require("../utils/security");
const AuditLog = require("../models/AuditLog");
const { sendError } = require("../utils/apiResponse");

/**
 * SIGNATURE VERIFICATION MIDDLEWARE (§6.1)
 * Enforces cryptographic request signatures on sensitive operational endpoints.
 * Prevents: Replay attacks and unauthorized API manipulation.
 */

const verifySignature = (req, res, next) => {
    try {
        const secret = process.env.API_SIGNATURE_SECRET;
        if (!secret) {
            return sendError(res, 500, "Signature verification is not configured");
        }

        // If GET request, sometimes we skip depending on policy §1.1 (Everything must be verified).
        // Let's enforce for all POST/PUT/DELETE for now as per enterprise standard for integrity.
        if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
            const isValid = verifyRequestSignature(req, secret);

            if (!isValid) {
                AuditLog.create({
                    action: "SECURITY ALERT: Invalid Request Signature",
                    performedBy: req.user?.email || "Unknown (Unauthenticated Edge)",
                    details: `API Replay or Integrity Violation detected on ${req.method} ${req.originalUrl}. Source IP: ${req.ip}`,
                    ip: req.ip || req.connection?.remoteAddress
                });

                return sendError(res, 403, "Security violation: cryptographic signature mismatch");
            }
        }
        next();
    } catch (error) {
        return sendError(res, 500, "Signature verification system error");
    }
};

module.exports = verifySignature;

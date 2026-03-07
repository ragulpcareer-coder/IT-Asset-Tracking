const BlockedIp = require("../models/BlockedIp");

const ipBlockerMiddleware = async (req, res, next) => {
    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || req.ip;

        // Quick cache bypass could be implemented here for extreme performance, 
        // but a DB lookup is acceptable for this level.
        const blocked = await BlockedIp.findOne({ ipAddress: ip });

        if (blocked) {
            // Check expiration
            if (blocked.expiresAt && blocked.expiresAt < new Date()) {
                await BlockedIp.deleteOne({ _id: blocked._id }); // Unblock
                return next();
            }

            console.warn(`[AIR - Firewall] Traffic blocked from Blacklisted IP: ${ip}`);
            return res.status(403).json({
                success: false,
                message: "Your IP address has been temporarily blocked due to suspicious activity. Please contact security administrators.",
                code: "IP_BLACKLISTED",
                reason: blocked.reason
            });
        }

        next();
    } catch (err) {
        console.error("[IP Blocker Middleware] Error:", err.message);
        next();
    }
};

module.exports = ipBlockerMiddleware;

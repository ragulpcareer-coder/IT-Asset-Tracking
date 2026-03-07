const User = require("../models/User");
const SecurityAlert = require("../models/SecurityAlert");
const tokenManager = require("../utils/tokenManager");

class IncidentResponseService {
    /**
     * Immediately terminates all active sessions for a user by rotating the Token Version.
     * This is the functional equivalent of forcefully invalidating all issued JWTs.
     * 
     * @param {string} userId - Target User ObjectId
     * @param {string} triggerReason - The anomaly that caused the mitigation
     */
    async terminateAllSessions(userId, triggerReason) {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            user.tokenVersion += 1;
            await user.save();

            // Log the Automated Response
            await SecurityAlert.create({
                type: "ZERO_TRUST_VIOLATION",
                severity: "CRITICAL",
                message: "Automated Incident Response: ALL SESSIONS TERMINATED",
                details: `AIR Engine force-invalidated all JWTs due to: ${triggerReason}`,
                userId: user._id
            });

            // Broadcast globally to SOC dashboards
            if (global.io) {
                global.io.emit("security_event", {
                    severity: "critical",
                    message: `Incident Mitigated: All active sessions for ${user.email} terminated. (${triggerReason})`,
                    time: new Date()
                });
            }

            console.log(`[AIR] Terminated all sessions for user ${user.email}`);
        } catch (err) {
            console.error("[AIR] Failed to terminate sessions:", err.message);
        }
    }

    /**
     * Locks the user account for the specified duration.
     * 
     * @param {string} userId - Target User ObjectId
     * @param {number} durationMinutes - Lock duration in minutes
     * @param {string} triggerReason - The anomaly that caused the lockout
     */
    async lockAccount(userId, durationMinutes = 15, triggerReason) {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            const lockUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
            await User.updateOne({ _id: user._id }, { $set: { lockUntil } });

            await SecurityAlert.create({
                type: "BRUTE_FORCE",
                severity: "HIGH",
                message: `Automated Incident Response: ACCOUNT LOCKED (${durationMinutes}m)`,
                details: `AIR Engine locked account due to: ${triggerReason}`,
                userId: user._id
            });

            if (global.io) {
                global.io.emit("security_event", {
                    severity: "high",
                    message: `Incident Mitigated: Account for ${user.email} locked for ${durationMinutes} minutes. (${triggerReason})`,
                    time: new Date()
                });
            }

            console.log(`[AIR] Locked account for ${user.email}`);
        } catch (err) {
            console.error("[AIR] Failed to lock account:", err.message);
        }
    }
}

module.exports = new IncidentResponseService();

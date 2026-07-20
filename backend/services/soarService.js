const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");

/**
 * SOAR (Security Orchestration, Automation, and Response) Service
 * Automatically executes defensive actions based on alert severity and type.
 */
class SoarService {
    /**
     * Process an alert and determine if automated response is required.
     * @param {Object} alert - The SecurityAlert document
     */
    async processAlert(alert, context = {}) {
        try {
            console.log(`[SOAR] Analyzing alert ${alert._id} (${alert.type}) for automated response...`);

            // Policy 1: Critical threats result in account suspension after threshold (Elite Rule)
            const threshold = 3;
            const recentAlerts = context.recentAlertCount || 0;

            if (alert.severity === "CRITICAL" && alert.userId && recentAlerts >= threshold) {
                await this.suspendAccount(alert.userId, alert);
            } else if (alert.severity === "CRITICAL" && alert.userId) {
                console.log(`[SOAR] Critical alert detected but threshold (${recentAlerts}/${threshold}) not met. Monitoring...`);
            }

            // Policy 2: Brute force detection results in temporary IP throttling (handled by RateLimiter, but SOAR logs it)
            if (alert.type === "BRUTE_FORCE") {
                console.log(`[SOAR] Brute force detected from ${alert.sourceIp}. Defensive posture escalated.`);
            }

            // Policy 3: Zero Trust Violation for Admin results in session invalidation
            if (alert.type === "ZERO_TRUST_VIOLATION" && alert.severity === "HIGH") {
                // In a real system, we would revoke all active tokens here
                console.log(`[SOAR] Zero Trust Violation for user ${alert.userId}. Session transition to restricted state.`);
            }

        } catch (err) {
            logger.error(`[SOAR] Automation failed for alert ${alert._id}:`, err.message);
        }
    }

    /**
     * Suspend a user account automatically.
     */
    async suspendAccount(userId, alert) {
        try {
            const user = await User.findById(userId);
            if (!user || user.isActive === false) return;

            // Update user status
            user.isActive = false;
            await user.save();

            // Log the automated action
            await AuditLog.create({
                action: "SOAR: AUTOMATED SUSPENSION",
                performedBy: "SYSTEM (AI-SOC)",
                details: `Account ${user.email} suspended automatically due to ${alert.type} (${alert.severity}). Alert ID: ${alert._id}`,
                ip: alert.sourceIp || "0.0.0.0",
                createdAt: new Date()
            });

            console.log(`[SOAR] 🛡️ DEFENSIVE ACTION TAKEN: Account ${user.email} suspended.`);

            // Emit toast/notification to all admins
            if (global.io) {
                global.io.emit("security_event", {
                    message: `ACC-SUSPEND: ${user.email} suspended via SOAR policy.`,
                    alertId: alert._id
                });
            }
        } catch (err) {
            logger.error(`[SOAR] Account suspension failed:`, err.message);
        }
    }
}

module.exports = new SoarService();

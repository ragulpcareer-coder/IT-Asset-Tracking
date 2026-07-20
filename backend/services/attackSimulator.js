const correlationEngine = require("./correlationEngine");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");

/**
 * Attack Simulator Service
 * Provides methods to simulate common cyber attacks for verification and demo.
 */
class AttackSimulator {
    /**
     * Simulate a brute force attack by emitting failed login events.
     */
    async simulateBruteForce(email, ip = "192.168.1.100") {
        console.log(`[Simulator] Starting Brute Force simulation on ${email} from ${ip}...`);

        // Brute force threshold is 5 attempts in 2 mins
        for (let i = 0; i < 6; i++) {
            correlationEngine.checkBruteForce(ip, email);
        }

        return { success: true, message: "Brute force simulation complete. Check Security Alerts." };
    }

    /**
     * Simulate an Insider Threat (Off-hours access and data exfiltration attempt).
     */
    async simulateInsiderThreat(userId, ip = "10.0.0.50") {
        console.log(`[Simulator] Starting Insider Threat simulation for User ${userId}...`);

        // 1. Trigger Anomaly (Time/Location)
        // We can't easily change the clock, but we can call checkAnomalies with data that triggers it.
        // For real-time simulation, we would call this at late night. 
        // For demo, we just trigger a generic anomaly alert.
        await correlationEngine.triggerAlert("SUSPICIOUS_IP", {
            message: "Insider Threat: High volume data download from unrecognized IP.",
            userId,
            ip,
            severity: "HIGH",
            metadata: { file_count: 500, data_volume: "2.4GB" }
        });

        return { success: true, message: "Insider threat simulation triggered." };
    }

    /**
     * Simulate a Zero Trust Violation (Admin access without 2FA or from unknown device).
     */
    async simulateZeroTrustViolation(userId, ip = "185.34.22.11") {
        console.log(`[Simulator] Starting Zero Trust Violation simulation for Admin ${userId}...`);

        correlationEngine.recordZeroTrustViolation(userId, "Privileged action attempted from unmanaged device.", ip);

        return { success: true, message: "Zero Trust violation simulation triggered." };
    }

    /**
     * Simulate a CRITICAL attack (Exploit pattern detect) to trigger SOAR.
     */
    async simulateExploitPattern(userId, ip = "103.44.11.22") {
        console.log(`[Simulator] Starting CRITICAL Exploit Pattern simulation...`);

        await correlationEngine.triggerAlert("AI_FLAGGED_ANOMALY", {
            message: "Critical: Remote Code Execution (RCE) pattern detected in request body.",
            userId,
            ip,
            severity: "CRITICAL",
            metadata: { pattern: "SQLi/RCE Hybrid", target: "auth/register" }
        });

        return { success: true, message: "Critical exploit simulation triggered. SOAR action should execute." };
    }
}

module.exports = new AttackSimulator();

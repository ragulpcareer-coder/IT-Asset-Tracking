/**
 * ENTERPRISE DETECTION ENGINE — IT Asset Tracking System
 * POLICY: Behavioral Detection | Anomaly Detection | MITRE ATT&CK Mapping
 * Addressing SOC Category 3 & 4.
 */

const AuditLog = require("../models/AuditLog");
const SecurityAlert = require("../models/SecurityAlert");
const logger = require("./logger");

const MITRE_MAPPING = {
    BRUTE_FORCE: { tactic: "Credential Access", technique: "T1110", name: "Brute Force" },
    ROGUE_NODE: { tactic: "Initial Access", technique: "T1190", name: "Exploit Public-Facing Application" },
    UNAUTHORIZED_CMD: { tactic: "Execution", technique: "T1059", name: "Command and Scripting Interpreter" },
    DATA_EXFILTRATION: { tactic: "Exfiltration", technique: "T1041", name: "Exfiltration Over C2 Channel" },
    PRIVILEGE_ESCALATION: { tactic: "Privilege Escalation", technique: "T1548", name: "Abuse Elevation Control Mechanism" },
    LATERAL_MOVEMENT: { tactic: "Lateral Movement", technique: "T1021", name: "Remote Services" },
    PERSISTENCE: { tactic: "Persistence", technique: "T1136", name: "Create Account" }
};

class DetectionEngine {
    /**
     * Monitor EDR Telemetry for anomalies
     */
    async analyzeEndpointTelemetry(asset, telemetry) {
        const alerts = [];
        const { edrTelemetry } = telemetry;

        if (!edrTelemetry) return alerts;

        // 1. Critical Process Monitoring (Execution Tactic)
        if (edrTelemetry.criticalInstances && edrTelemetry.criticalInstances.length > 0) {
            const procNames = edrTelemetry.criticalInstances.map(p => p.name).join(', ');
            alerts.push({
                type: "UNAUTHORIZED_CMD",
                severity: "Medium",
                details: `Critical shell processes detected: ${procNames}. Potential unauthorized command execution.`
            });
        }

        // 2. Anomaly Detection: Connection Threshold (C2 Detection)
        if (edrTelemetry.networkQuarantine) {
            alerts.push({
                type: "DATA_EXFILTRATION",
                severity: "High",
                details: `Abnormal outbound connection volume detected (${edrTelemetry.activeConnections.length} peaks). Potential C2 heartbeat or data exfiltration.`
            });
        }

        // 3. Insider Threat: Non-admin using shell tools
        const shellProcs = edrTelemetry.criticalInstances || [];
        shellProcs.forEach(proc => {
            if (proc.user && !['root', 'administrator', 'system'].includes(proc.user.toLowerCase())) {
                alerts.push({
                    type: "PRIVILEGE_ESCALATION",
                    severity: "High",
                    details: `Standard user [${proc.user}] spawned shell [${proc.name}]. Internal privilege escalation suspected.`
                });
            }
        });

        // Process all identified alerts
        for (const alert of alerts) {
            const mitre = MITRE_MAPPING[alert.type] || { tactic: "Unknown", technique: "NA", name: alert.type };

            // 1. Log to AuditLog (Legacy/Strategic Registry)
            await AuditLog.create({
                action: `DETECTION: ${mitre.name} [${mitre.technique}]`,
                performedBy: asset.name || "Endpoint Agent",
                details: alert.details,
                ip: asset.ipAddress || "Unknown",
                meta: {
                    tactic: mitre.tactic,
                    technique: mitre.technique,
                    severity: alert.severity,
                    source: "EDR_DETECTION_ENGINE"
                }
            });

            // 2. Log to dedicated SecurityAlert model (New SOC Platform Registry)
            await SecurityAlert.create({
                type: alert.type,
                severity: alert.severity,
                message: `${mitre.name}: ${alert.details}`,
                details: alert.details,
                assetId: asset._id,
                performedBy: asset.name || "Endpoint Agent",
                ip: asset.ipAddress || "Unknown",
                mitreTactic: mitre.tactic,
                mitreTechnique: mitre.technique
            });

            logger.warn(`SECURITY_DETECTION: ${mitre.name} on ${asset.name}. Tactic: ${mitre.tactic}`);
        }

        return alerts;
    }

    /**
     * analyzeAuthAttempt - detect brute force and impossible travel
     */
    async analyzeAuthAttempt(user, ip, success) {
        // Brute force is already handled in authController, but we could add "Impossible Travel" here
        // Logic: if lastLoginIp changed and distance > threshold in short time
    }
}

module.exports = new DetectionEngine();

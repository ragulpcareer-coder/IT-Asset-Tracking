const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const Asset = require("../models/Asset");
const { encryptSensitiveData } = require("../utils/security");
const { sendError, sendSuccess } = require("../utils/apiResponse");

exports.rotateSystemSecrets = async (req, res) => {
    try {
        const newSecret = crypto.randomBytes(32).toString("hex");
        process.env.API_SIGNATURE_SECRET = newSecret;

        await AuditLog.create({
            action: "SECURITY: Secret Key Rotation",
            performedBy: req.user.email,
            details: "System operational secrets rotated successfully. Previous keys invalidated.",
            ip: req.ip || req.connection?.remoteAddress
        });

        return sendSuccess(res, 200, "System security keys rotated", {
            warning: "Existing client-side sessions using old signatures will need to re-fetch keys or re-authenticate."
        });
    } catch (error) {
        return sendError(res, 500, "Key rotation procedure failed.");
    }
};

exports.getSecurityStatus = async (req, res) => {
    try {
        const adminCount = await User.countDocuments({ role: { $in: ["Super Admin", "Admin"] } });
        const lockedAccounts = await User.countDocuments({ lockUntil: { $gt: new Date() } });
        const adminAlert = adminCount > 5;

        return sendSuccess(res, 200, "Security health check completed", {
            trustScore: "High-Assurance",
            adminCount,
            adminAlert: adminAlert ? "CRITICAL: High number of administrative accounts detected. Violates operational policy." : "Compliant",
            lockedAccounts,
            integrityCheck: "Continuous (linked-hash active)",
            timestamp: new Date()
        });
    } catch (error) {
        return sendError(res, 500, "Security health check failed.");
    }
};

exports.triggerManualBackup = async (req, res) => {
    try {
        const backupSecret = process.env.BACKUP_SECRET;
        if (!backupSecret) {
            return sendError(res, 500, "Backup encryption is not configured");
        }

        const backupDir = path.join(__dirname, "..", "backups");
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `manual-backup-${timestamp}.json`;
        const backupFile = path.join(backupDir, filename);

        const [users, assets, audits] = await Promise.all([
            User.find({}).lean(),
            Asset.find({}).lean(),
            AuditLog.find({}).lean(),
        ]);

        const backupData = JSON.stringify({ timestamp: new Date(), collections: { users, assets, audits } });
        const encrypted = encryptSensitiveData(backupData, backupSecret);
        fs.writeFileSync(backupFile, encrypted);

        await AuditLog.create({
            action: "SECURITY: Manual System Backup",
            performedBy: req.user.email,
            details: `Admin-initiated encrypted database backup created: ${filename}.`,
            ip: req.ip || req.connection?.remoteAddress
        });

        return sendSuccess(res, 200, "Enterprise backup successfully encrypted and stored on-site.", { filename });
    } catch (error) {
        return sendError(res, 500, "Manual backup failed.");
    }
};

exports.downloadBackup = async (req, res) => {
    try {
        const { filename } = req.params;
        const backupFile = path.join(__dirname, "..", "backups", filename);

        if (!fs.existsSync(backupFile)) {
            return sendError(res, 404, "Backup file not found.", { filename: "not_found" });
        }

        return res.download(backupFile);
    } catch (error) {
        return sendError(res, 500, "Download failed.");
    }
};

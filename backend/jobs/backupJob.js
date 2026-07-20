const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Asset = require('../models/Asset');
const AuditLog = require('../models/AuditLog');

// Backup directory
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// @desc Routine job to create professional local backups every night at 2:00 AM
const backupTask = cron.schedule('0 2 * * *', async () => {
    console.log('🔄 Initiating Automated Zero-Trust Database Backup...');
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

        const users = await User.find({});
        const assets = await Asset.find({});
        const audits = await AuditLog.find({});

        const backupData = {
            timestamp: new Date(),
            collections: {
                users,
                assets,
                audits
            }
        };

        const { encryptSensitiveData } = require('../utils/security');
        const backupSecret = process.env.BACKUP_SECRET || process.env.JWT_SECRET || 'emergency_backup_key_32_chars_long!!';

        const jsonData = JSON.stringify(backupData);
        const encryptedData = encryptSensitiveData(jsonData, backupSecret);

        fs.writeFileSync(backupFile, encryptedData);
        console.log(`✅ Local Encrypted backup successfully created at: ${backupFile} (Policy §19)`);

        // Cloud Backup to AWS S3 (Cybersecurity Enterprise Feature)
        try {
            if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET) {
                const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
                const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
                const fileContent = fs.readFileSync(backupFile);

                await s3.send(new PutObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: `backups/backup-${timestamp}.json`,
                    Body: fileContent,
                    ContentType: 'application/json'
                }));
                console.log(`☁️ Cloud Backup successfully uploaded to S3 Bucket: ${process.env.AWS_S3_BUCKET}`);
            } else {
                console.log(`☁️ Skipping S3 Cloud backup, AWS credentials not fully configured in env.`);
            }
        } catch (s3Error) {
            console.error('❌ Failed to upload backup to S3:', s3Error.message);
        }

        // Optional: Clean up old local backups (keep last 7)
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
            .sort((a, b) => fs.statSync(path.join(backupDir, b)).mtime.getTime() - fs.statSync(path.join(backupDir, a)).mtime.getTime());

        if (files.length > 7) {
            for (let i = 7; i < files.length; i++) {
                fs.unlinkSync(path.join(backupDir, files[i]));
            }
            console.log('🧹 Cleaned up outdated local backups.');
        }
    } catch (error) {
        console.error('❌ Failed to execute automated backup:', error);
    }
});

module.exports = backupTask;

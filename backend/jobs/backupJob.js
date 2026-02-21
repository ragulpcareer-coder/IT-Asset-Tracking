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

        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        console.log(`✅ Backup successfully created at: ${backupFile}`);

        // Optional: Clean up old backups (keep last 7)
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
            .sort((a, b) => {
                return fs.statSync(path.join(backupDir, b)).mtime.getTime() - fs.statSync(path.join(backupDir, a)).mtime.getTime();
            });

        if (files.length > 7) {
            for (let i = 7; i < files.length; i++) {
                fs.unlinkSync(path.join(backupDir, files[i]));
            }
            console.log('🧹 Cleaned up outdated backups.');
        }
    } catch (error) {
        console.error('❌ Failed to execute automated backup:', error);
    }
});

module.exports = backupTask;

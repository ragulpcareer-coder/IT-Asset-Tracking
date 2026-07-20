const cron = require('node-cron');
const Asset = require('../models/Asset');
const AuditLog = require('../models/AuditLog');

console.log('Automated warranty job initialized.');

// Run every day at midnight (system timezone)
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('Running daily warranty check job...');
        const today = new Date();
        const next30Days = new Date();
        next30Days.setDate(next30Days.getDate() + 30);

        // 1. Flag assets whose warranty is expiring in the next 30 days
        const expiringAssets = await Asset.find({
            warrantyExpiry: { $gte: today, $lte: next30Days },
            status: { $nin: ['retired', 'maintenance'] }
        });

        if (expiringAssets.length > 0) {
            console.log(`Found ${expiringAssets.length} assets with expiring warranties.`);

            await AuditLog.create({
                action: 'Warranty Expiring Soon',
                performedBy: 'System Auto Job',
                details: `Flagged ${expiringAssets.length} active assets with warranty expiring within 30 days.`,
                meta: { count: expiringAssets.length }
            });
        }

        // 2. Prevent active usage of severely expired assets (optional strict rule setup)
        const expiredAssets = await Asset.updateMany(
            { warrantyExpiry: { $lt: today }, status: "available" },
            { $set: { status: 'maintenance' } }
        );

        if (expiredAssets.modifiedCount > 0) {
            console.log(`Auto-flagged ${expiredAssets.modifiedCount} expired assets for maintenance.`);
            await AuditLog.create({
                action: 'Automated Warranty Expiry',
                performedBy: 'System Auto Job',
                details: `Automatically changed status to 'maintenance' for ${expiredAssets.modifiedCount} assets due to expired warranties.`,
                meta: { expiredCount: expiredAssets.modifiedCount }
            });
        }
    } catch (error) {
        console.error('Warranty Job Error:', error);
    }
});

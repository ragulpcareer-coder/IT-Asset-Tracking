const cron = require('node-cron');
const AuditLog = require('../models/AuditLog');
const ms = require('ms');

// Run daily at 03:30 UTC to purge old audit logs based on retention days
const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '365', 10);

async function purgeOldLogs() {
  try {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });
    console.log(`AuditRetention: removed ${result.deletedCount} logs older than ${retentionDays} days`);
  } catch (err) {
    console.error('AuditRetention: purge failed', err);
  }
}

// Schedule: every day at 03:30
cron.schedule('30 3 * * *', () => {
  console.log('AuditRetention: running daily purge job');
  purgeOldLogs();
});

// Also expose a manual runner
module.exports = {
  purgeOldLogs,
};

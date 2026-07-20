const cron = require("node-cron");
const nodemailer = require("nodemailer");
const Asset = require("../models/Asset");
const AuditLog = require("../models/AuditLog");

/**
 * Warranty Expiry Cron Job
 * 
 * Runs daily to:
 * - Check for assets with upcoming warranty expiry
 * - Send email notifications to asset managers
 * - Create audit logs of notifications sent
 * 
 * Configurable thresholds:
 * - UPCOMING_THRESHOLD: Days before expiry to send warning (default: 30)
 * - EMAIL_TIME: Time to run the job (default: 09:00)
 */

class WarrantyExpiryJob {
  constructor() {
    this.UPCOMING_THRESHOLD = 30; // Days
    this.CRITICAL_THRESHOLD = 7; // Critical warning
    this.emailTransporter = null;
    this.jobRunning = false;
  }

  /**
   * Initialize email transporter
   */
  initializeEmailTransporter() {
    // Configure based on your email provider
    this.emailTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  /**
   * Send warranty expiry notification email
   */
  async sendWarrantyExpiryEmail(asset, daysRemaining, manager) {
    try {
      if (!this.emailTransporter) {
        this.initializeEmailTransporter();
      }

      const severity = daysRemaining <= this.CRITICAL_THRESHOLD ? "CRITICAL" : "WARNING";

      const emailContent = `
        <h2>Warranty Expiry Notification - ${severity}</h2>
        <p>Dear Asset Manager,</p>
        
        <p>The following asset warranty is expiring soon:</p>
        
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Asset ID</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${asset._id}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Asset Name</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${asset.name}</td>
          </tr>
          <tr style="background: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Serial Number</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${asset.serialNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Warranty End Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${new Date(asset.warrantyExpiry).toLocaleDateString()}</td>
          </tr>
          <tr style="background: #fff3cd;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Days Remaining</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>${daysRemaining} days</strong></td>
          </tr>
        </table>
        
        <p style="color: ${daysRemaining <= this.CRITICAL_THRESHOLD ? "#dc3545" : "#ff9800"};">
          ${daysRemaining <= this.CRITICAL_THRESHOLD
            ? "🚨 CRITICAL: Warranty expires within 7 days. Immediate action required."
            : `⚠️ WARNING: Warranty expires in ${daysRemaining} days.`
          }
        </p>
        
        <p>
          Please consider:
          <ul>
            <li>Extending the warranty if needed</li>
            <li>Planning for replacement or repair</li>
            <li>Documenting maintenance records</li>
            <li>Updating asset status in the system</li>
          </ul>
        </p>
        
        <p>
          <a href="${process.env.FRONTEND_URL}/assets/${asset._id}" 
             style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Asset Details
          </a>
        </p>
        
        <p>Best regards,<br>IT Asset Tracker System</p>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: manager.email,
        subject: `${severity}: Warranty Expiring - ${asset.name}`,
        html: emailContent,
      };

      await this.emailTransporter.sendMail(mailOptions);
      return { success: true, email: manager.email };
    } catch (error) {
      console.error(`Failed to send warranty expiry email for asset ${asset._id}:`, error);
      return { success: false, email: manager.email, error: error.message };
    }
  }

  /**
   * Check for expiring warranties and send notifications
   */
  async checkExpiringWarranties() {
    try {
      const now = new Date();
      const upcomingDate = new Date(now.getTime() + this.UPCOMING_THRESHOLD * 24 * 60 * 60 * 1000);

      // Find assets expiring soon
      const expiringAssets = await Asset.find({
        warrantyExpiry: {
          $gte: now,
          $lte: upcomingDate,
        },
        warrantyNotificationSent: {
          $ne: true, // Don't spam - only send once
        },
      }).populate("assignedTo", "email name");

      let notificationsSent = 0;
      let notificationsFailed = 0;

      for (const asset of expiringAssets) {
        const daysRemaining = Math.ceil(
          (new Date(asset.warrantyExpiry) - now) / (1000 * 60 * 60 * 24)
        );

        // Send email to asset manager or assignee
        const manager = asset.assignedTo || { email: process.env.ADMIN_EMAIL };

        if (manager && manager.email) {
          const result = await this.sendWarrantyExpiryEmail(asset, daysRemaining, manager);

          if (result.success) {
            notificationsSent++;

            // Mark as notified (can be reset for re-notification if needed)
            asset.warrantyNotificationSent = true;
            asset.warrantyNotificationDate = new Date();
            await asset.save();

            // Log the notification
            await AuditLog.create({
              action: "Warranty Expiry Notification Sent",
              performedBy: "System (Cron Job)",
              resource: "Asset",
              resourceId: asset._id,
              details: `Warranty expiry notification sent for ${asset.name} (${daysRemaining} days remaining)`,
              severity: daysRemaining <= this.CRITICAL_THRESHOLD ? "CRITICAL" : "WARNING",
              status: "sent",
              createdAt: new Date(),
            });
          } else {
            notificationsFailed++;

            // Log failed notification
            await AuditLog.create({
              action: "Warranty Expiry Notification Failed",
              performedBy: "System (Cron Job)",
              resource: "Asset",
              resourceId: asset._id,
              details: `Failed to send warranty expiry notification: ${result.error}`,
              severity: "ERROR",
              status: "failed",
              createdAt: new Date(),
            });
          }
        }
      }

      return {
        success: true,
        assetsChecked: expiringAssets.length,
        notificationsSent,
        notificationsFailed,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Warranty expiry check failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for already-expired warranties
   */
  async checkExpiredWarranties() {
    try {
      const expiredAssets = await Asset.find({
        warrantyExpiry: { $lt: new Date() },
        status: { $ne: "archived" },
      });

      for (const asset of expiredAssets) {
        // Update asset status
        if (asset.status === "active") {
          asset.status = "maintenance"; // Mark for maintenance
          await asset.save();

          await AuditLog.create({
            action: "Warranty Expired",
            performedBy: "System (Cron Job)",
            resource: "Asset",
            resourceId: asset._id,
            details: `Asset warranty expired: ${asset.name}`,
            severity: "WARNING",
            status: "expired",
            createdAt: new Date(),
          });
        }
      }

      return {
        success: true,
        expiredAssetsFound: expiredAssets.length,
        assetsUpdated: expiredAssets.length,
      };
    } catch (error) {
      console.error("Expired warranty check failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule the warranty expiry job
   * Runs daily at 09:00 AM
   * 
   * Usage: job.schedule();
   */
  schedule(cronExpression = "0 9 * * *") {
    console.log(`[WarrantyExpiryJob] Scheduling warranty check at ${cronExpression}`);

    this.job = cron.schedule(cronExpression, async () => {
      if (this.jobRunning) {
        console.log("[WarrantyExpiryJob] Job already running, skipping...");
        return;
      }

      try {
        this.jobRunning = true;
        console.log(`[WarrantyExpiryJob] Started at ${new Date().toISOString()}`);

        // Check expiring warranties
        const expiringResult = await this.checkExpiringWarranties();
        console.log("[WarrantyExpiryJob] Expiring check result:", expiringResult);

        // Check already expired warranties
        const expiredResult = await this.checkExpiredWarranties();
        console.log("[WarrantyExpiryJob] Expired check result:", expiredResult);

        console.log(`[WarrantyExpiryJob] Completed at ${new Date().toISOString()}`);
      } catch (error) {
        console.error("[WarrantyExpiryJob] Error:", error);
      } finally {
        this.jobRunning = false;
      }
    });

    return this.job;
  }

  /**
   * Stop the scheduled job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      console.log("[WarrantyExpiryJob] Stopped");
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      scheduled: !!this.job,
      running: this.jobRunning,
      nextRun: this.job ? this.job.nextDate().toISOString() : null,
    };
  }
}

module.exports = WarrantyExpiryJob;

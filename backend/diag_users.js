const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load env
const envPath = path.resolve(__dirname, "backend.env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

const User = require("./models/User");
const AuditLog = require("./models/AuditLog");

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        console.log("\n--- All Users ---");
        const allUsers = await User.find().select("email role isActive isApproved failedLoginAttempts lockUntil");
        allUsers.forEach(u => {
            console.log(`[${u.role}] ${u.email} - Active: ${u.isActive}, Approved: ${u.isApproved}, Fails: ${u.failedLoginAttempts}, Locked: ${!!(u.lockUntil && u.lockUntil > Date.now())}`);
        });

        console.log("\n--- Recent Audit Logs (Last 20) ---");
        const logs = await AuditLog.find().sort({ createdAt: -1, timestamp: -1 }).limit(20);
        logs.forEach(log => {
            const time = log.createdAt || log.timestamp || "No Time";
            console.log(`[${time instanceof Date ? time.toISOString() : time}] ${log.action} - ${log.performedBy}: ${log.details}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Diagnosis Failed:", err);
        process.exit(1);
    }
}

diagnose();

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load Environment variables securely
const envPath = path.resolve(__dirname, "../backend.env");
require("dotenv").config({ path: envPath });

const wipeEnvironment = async () => {
    try {
        console.log("Connecting to Mongoose...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected directly to Database.");

        // Bypassing Mongoose Middlewares (`User.deleteMany` & `AuditLog.deleteMany` trigger hooks)
        // by executing the drop/delete directly on the native mongo collections
        console.log("Wiping all Users & Sessions directly at native level...");
        await mongoose.connection.db.collection("users").deleteMany({});

        console.log("Wiping all AuditLogs directly at native level...");
        await mongoose.connection.db.collection("auditlogs").deleteMany({});

        console.log("✅ WIPE COMMAND COMPLETED SUCCESSFULLY.");
        console.log("Database is now pristine. Next user to register will be awarded core Admin privilege.");
        process.exit(0);

    } catch (err) {
        console.error("Fatal Error during wipe sequence: ", err);
        process.exit(1);
    }
}

wipeEnvironment();

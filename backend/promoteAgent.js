const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "backend.env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const User = require("./models/User");
const connectDB = require("./config/db");

async function promoteAgent() {
    await connectDB();
    const res = await User.findOneAndUpdate(
        { email: "john@admin.com" },
        { role: "Admin", isApproved: true },
        { new: true }
    );
    console.log("Promoted John Agent:", res);
    process.exit(0);
}
promoteAgent();

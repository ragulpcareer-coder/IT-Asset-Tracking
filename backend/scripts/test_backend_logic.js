const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load env
const envPath = path.resolve(__dirname, "../backend.env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

const User = require("../models/User");

async function testUpdate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // Find the primary user
        const user = await User.findOne({ email: "ragulp.career@gmail.com" });
        if (!user) {
            console.log("User not found");
            process.exit(1);
        }

        console.log("Before Update:", JSON.stringify(user.activityTimestamps, null, 2));

        // Simulate updateProfile logic
        if (!user.activityTimestamps) user.activityTimestamps = {};
        user.activityTimestamps.profileUpdatedAt = new Date();

        // Simulate preferences update
        user.preferences = {
            ...(user.preferences || {}),
            emailNotifications: false
        };

        await user.save();
        console.log("After Update:", JSON.stringify(user.activityTimestamps, null, 2));
        console.log("Preferences after:", JSON.stringify(user.preferences, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testUpdate();

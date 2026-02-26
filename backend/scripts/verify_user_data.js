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

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const users = await User.find({});
        console.log(`Found ${users.length} users`);

        users.forEach(u => {
            console.log(`--- User: ${u.email} ---`);
            console.log(`Preferences:`, JSON.stringify(u.preferences, null, 2));
            console.log(`Activity:`, JSON.stringify(u.activityTimestamps, null, 2));
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();

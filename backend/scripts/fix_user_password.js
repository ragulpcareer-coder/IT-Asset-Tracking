const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
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

async function resetPassword() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const email = "ragulp.career@gmail.com";
        const newPassword = "1aA/1234/1234";

        const user = await User.findOne({ email });
        if (!user) {
            console.log(`User ${email} not found`);
            process.exit(1);
        }

        // Set password (pre-save hook will hash it)
        user.password = newPassword;

        // Ensure all required session fields are reset
        user.failedLoginAttempts = 0;
        user.lockUntil = undefined;
        user.isApproved = true; // Ensure they can login
        user.isActive = true;

        await user.save();
        console.log(`Password for ${email} has been reset to: ${newPassword}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

resetPassword();

const mongoose = require("mongoose");
const path = require("path");

const envPath = path.resolve(__dirname, "../backend.env");
require("dotenv").config({ path: envPath });

const unlockDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const User = mongoose.connection.db.collection("users");

        const users = await User.find({}).toArray();
        console.log(`Checking ${users.length} users in DB for locks...`);

        const bcrypt = require("bcryptjs");
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("Admin@2026", salt);

        const updates = {
            password: hashedPassword,
            isActive: true,
            isApproved: true,
            lockUntil: null,
            failedLoginAttempts: 0,
            isTwoFactorEnabled: false
        };

        await User.updateOne({ email: "ragulp.career@gmail.com" }, { $set: updates });
        console.log(`=> Password successfully reset to Admin@2026 for ragulp.career@gmail.com`);

        console.log(`Finished. Total fixed: ${changed}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
unlockDB();

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
        
        let changed = 0;
        for (const u of users) {
             const updates = {
                 isActive: true,
                 isApproved: true,
                 lockUntil: null,
                 failedLoginAttempts: 0,
                 isTwoFactorEnabled: false
             };
             
             await User.updateOne({ _id: u._id }, { $set: updates });
             changed++;
             console.log(`=> Resetted Access & Disabled 2FA for: ${u.email}`);
        }
        
        console.log(`Finished. Total fixed: ${changed}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
unlockDB();

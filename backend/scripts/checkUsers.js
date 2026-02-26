const mongoose = require("mongoose");
const path = require("path");

const envPath = path.resolve(__dirname, "../backend.env");
require("dotenv").config({ path: envPath });

const checkDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await mongoose.connection.db.collection("users").find({}).toArray();
        console.log(`Total users in DB: ${users.length}`);
        users.forEach(u => {
            console.log(`- ${u.email} | Role: ${u.role} | Approved: ${u.isApproved}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkDB();

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "backend.env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const User = require("./models/User");
const connectDB = require("./config/db");

async function bypass2FA() {
    await connectDB();
    const res = await mongoose.connection.collection('users').updateOne(
        { email: "ragulp.career@gmail.com" },
        { $set: { isTwoFactorEnabled: true, twoFactorSecret: "M5GTYMCPGFVXKNLBNRHCMM3TOMWC4WTMPUYXIPCVMVRUASRDO44Q", __enc_twoFactorSecret: false } }
    );
    console.log("Bypassed 2FA for Ragul Admin (native collection update):", res);
    process.exit(0);
}
bypass2FA();

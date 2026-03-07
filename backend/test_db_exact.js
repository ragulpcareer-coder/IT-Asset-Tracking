const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Mimic server.js env loading
const envPath = path.resolve(__dirname, "backend.env.tmp"); // We renamed it
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config({ path: path.resolve(__dirname, ".env") });
}

console.log("Testing MONGO_URI:", process.env.MONGO_URI);

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });
        console.log(`SUCCESS: MongoDB Connected: ${conn.connection.host}`);
        process.exit(0);
    } catch (err) {
        console.error("FAIL: MongoDB Connection Failed:", err.message);
        process.exit(1);
    }
};

connectDB();

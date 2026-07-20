const mongoose = require("mongoose");

const RETRY_DELAY_MS = 5000;

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 20,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip IPv6 attempt for faster local connection
      autoIndex: process.env.NODE_ENV !== "production",
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Seed default admin user on DB connect
    const { seedAdmin } = require("../utils/seeder");
    await seedAdmin();
  } catch (err) {
    console.error(
      `MongoDB Connection Failed: ${err.message}\n` +
      `  The server will keep running so you can see this message, but every\n` +
      `  database-backed request (login, register, etc.) will fail until this\n` +
      `  is fixed. Check MONGO_URI in backend/.env and confirm MongoDB is\n` +
      `  reachable. Retrying in ${RETRY_DELAY_MS / 1000}s...`,
    );
    setTimeout(connectDB, RETRY_DELAY_MS);
  }
};

module.exports = connectDB;


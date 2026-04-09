const mongoose = require("mongoose");

const { seedAdmin } = require("../utils/seeder");

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
    await seedAdmin();
  } catch (err) {
    console.error("MongoDB Connection Failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

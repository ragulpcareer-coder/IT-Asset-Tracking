const mongoose = require("mongoose");
require("dotenv").config();

const resetDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/asset-tracker");
    console.log("Connected to MongoDB");

    // Drop all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      await mongoose.connection.db.dropCollection(collection.name);
      console.log(`Dropped collection: ${collection.name}`);
    }

    console.log("✅ Database reset successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error resetting database:", err.message);
    process.exit(1);
  }
};

resetDatabase();

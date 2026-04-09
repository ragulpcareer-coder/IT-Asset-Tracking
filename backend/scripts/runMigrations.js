const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const DbMigration = require("../models/DbMigration");

dotenv.config({ path: path.resolve(__dirname, "..", "backend.env") });
dotenv.config();

const migrationsDir = path.resolve(__dirname, "..", "migrations");

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to run migrations.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    family: 4,
  });

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".js"))
    .sort();

  for (const file of files) {
    const migration = require(path.join(migrationsDir, file));
    const exists = await DbMigration.findOne({ migrationId: migration.id }).lean();
    if (exists) {
      console.log(`Skipping ${migration.id} (already applied)`);
      continue;
    }

    console.log(`Applying ${migration.id} - ${migration.description}`);
    await migration.up({ mongoose });
    await DbMigration.create({ migrationId: migration.id, description: migration.description });
  }

  await mongoose.disconnect();
  console.log("Migrations complete.");
}

run().catch(async (error) => {
  console.error("Migration runner failed:", error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});

const mongoose = require("mongoose");

const dbMigrationSchema = new mongoose.Schema({
  migrationId: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now },
}, { versionKey: false });

dbMigrationSchema.index({ migrationId: 1 }, { unique: true });

module.exports = mongoose.model("DbMigration", dbMigrationSchema);

"use strict";

const { Client, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "..", "backend.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const Asset = require("../models/Asset");

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("DISCORD_BOT_TOKEN missing in backend.env");
  process.exit(1);
}

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/it_asset_tracker";
mongoose.connect(mongoUri).then(() => {
  console.log("Discord bot connected to MongoDB");
}).catch((err) => {
  console.error("MongoDB connection failed:", err.message);
  process.exit(1);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const buildAssetSummary = (asset) => {
  if (!asset) return "Asset not found.";
  return [
    `Asset: ${asset.name}`,
    `Type: ${asset.type}`,
    `Serial: ${asset.serialNumber}`,
    `Status: ${asset.status}`,
    `Assigned To: ${asset.assignedTo || "Unassigned"}`,
    `Warranty: ${asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toDateString() : "N/A"}`,
    `Risk: ${asset.securityStatus?.riskLevel || "Low"} (${asset.riskScore || 0})`
  ].join("\n");
};

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  if (!content.startsWith("!status")) return;

  const serial = content.split(" ").slice(1).join(" ").trim();
  if (!serial) {
    return message.reply("Usage: `!status <serial-number>`");
  }

  const asset = await Asset.findOne({ serialNumber: serial });
  return message.reply(`\n${buildAssetSummary(asset)}`);
});

client.once("ready", () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
});

client.login(token);

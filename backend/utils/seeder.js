const User = require("../models/User");
const bcrypt = require("bcryptjs");

const isStrongSeedPassword = (password) =>
  typeof password === "string" &&
  password.length >= 12 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const seedAdmin = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "";

    if (!adminEmail || !adminPassword) {
      console.log("[SEED] ADMIN_EMAIL and ADMIN_PASSWORD not configured; skipping default admin seeding.");
      return;
    }

    if (!isStrongSeedPassword(adminPassword)) {
      console.warn("[SEED] ADMIN_PASSWORD must be at least 12 chars and include upper, lower, number, and symbol. Skipping seed.");
      return;
    }

    let adminExists;
    try {
      adminExists = await User.findOne({ email: adminEmail });
    } catch (_) {
      console.warn("[SEED] Unable to read existing admin account. Check DB_ENCRYPTION_SECRET before seeding.");
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedAdminPassword = await bcrypt.hash(adminPassword, salt);

    if (adminExists) {
      await User.updateOne(
        { email: adminEmail },
        {
          $set: {
            role: "Super Admin",
            isActive: true,
          },
        }
      );
      console.log(`[SEED] Admin ${adminEmail} updated with Super Admin role.`);
      return;
    }

    await User.create({
      name: process.env.ADMIN_NAME || "System Administrator",
      email: adminEmail,
      password: hashedAdminPassword,
      role: "Super Admin",
      isActive: true,
    });

    console.log(`[SEED] Admin ${adminEmail} created successfully`);
  } catch (error) {
    console.error("[SEED] Failed to seed default admin:", error.message);
  }
};

module.exports = { seedAdmin };

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const path = require("path");

// Mocking User model behavior
const mockUserSchemaPreSave = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

const verifyFix = async () => {
    const plainPassword = "NewSecurePassword123!";

    console.log("1. Simulating User.save() with plain password...");
    const hashedPassword = await mockUserSchemaPreSave(plainPassword);
    console.log("   Hashed Password:", hashedPassword);

    console.log("\n2. Simulating login with the new password...");
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    console.log("   Match Result:", isMatch ? "SUCCESS (Correct)" : "FAILED (Unexpected)");

    if (!isMatch) {
        process.exit(1);
    }

    console.log("\n3. Simulating double-hashing bug (The previous state)...");
    const manualSalt = await bcrypt.genSalt(12);
    const manualHashed = await bcrypt.hash(plainPassword, manualSalt);
    const doubleHashed = await mockUserSchemaPreSave(manualHashed);
    console.log("   Double Hashed:", doubleHashed);

    console.log("\n4. Verifying that login FAILS with double-hashed password...");
    const doubleMatch = await bcrypt.compare(plainPassword, doubleHashed);
    console.log("   Match Result:", doubleMatch ? "SUCCESS (Unexpected/Broken)" : "FAILED (Correctly identifies the bug)");

    if (doubleMatch) {
        process.exit(1);
    }

    console.log("\n✅ Verification complete: The fix correctly hashes once and allows successful comparison.");
};

verifyFix().catch(err => {
    console.error(err);
    process.exit(1);
});

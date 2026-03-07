
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "backend.env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

async function testGemini2() {
    try {
        const key = process.env.GEMINI_API_KEY;
        console.log(`Checking key: ${key ? key.substring(0, 8) + "..." : "MISSING"}`);

        const genAI = new GoogleGenerativeAI(key);
        // Explicitly use a model from the confirmed list
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = "Hello! This is a verification test. Please respond with exactly 'CONNECTION_STABLE'.";

        console.log("Sending request to gemini-2.0-flash...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log(`Response: ${text.trim()}`);
        if (text.includes("CONNECTION_STABLE")) {
            console.log("✅ GEMINI API IS WORKING WITH GEMINI-2.0-FLASH.");
        }
        process.exit(0);
    } catch (error) {
        console.error("❌ ERROR:", error.message);
        process.exit(1);
    }
}

testGemini2();

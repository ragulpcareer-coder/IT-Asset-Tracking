
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

async function testGemini() {
    try {
        const key = process.env.GEMINI_API_KEY;
        console.log(`Checking key: ${key ? key.substring(0, 8) + "..." : "MISSING"}`);

        if (!key) {
            console.error("GEMINI_API_KEY is not defined in backend.env");
            process.exit(1);
        }

        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Hello! This is a test from the AssetTrack SOC Platform. Please reply with 'SYSTEM_OK' if you can read this.";

        console.log("Sending test request to Gemini...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log(`Gemini response: ${text.trim()}`);

        if (text.includes("SYSTEM_OK")) {
            console.log("✅ GEMINI API IS FULLY FUNCTIONAL.");
        } else {
            console.log("⚠️ Received response, but payload did not match expected 'SYSTEM_OK'.");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ GEMINI API ERROR:", error.message);
        process.exit(1);
    }
}

testGemini();

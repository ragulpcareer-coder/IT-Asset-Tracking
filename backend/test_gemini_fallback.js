
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

async function listModels() {
    try {
        const key = process.env.GEMINI_API_KEY;
        if (!key) {
            console.error("GEMINI_API_KEY is not defined");
            process.exit(1);
        }

        const genAI = new GoogleGenerativeAI(key);
        // There isn't a direct 'listModels' in the simple SDK, it's usually via the client.
        // However, we can try to initialize with 'gemini-1.0-pro' as a fallback.

        console.log("Testing gemini-pro fallback...");
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("test");
        const response = await result.response;
        console.log("✅ gemini-pro is working.");
        process.exit(0);
    } catch (error) {
        console.error("❌ ERROR:", error.message);
        process.exit(1);
    }
}

listModels();


const https = require('https');
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "backend.env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

async function listModelsRaw() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("GEMINI_API_KEY is not defined");
        process.exit(1);
    }

    console.log("Fetching models list from Google API using native https...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                if (res.statusCode !== 200) {
                    console.error(`❌ API ERROR [${res.statusCode}]:`, parsed);
                    process.exit(1);
                }
                console.log("Available Models:");
                if (parsed.models) {
                    parsed.models.forEach(m => {
                        console.log(` - ${m.name} (${m.displayName})`);
                    });
                } else {
                    console.log("No models returned in response.");
                    console.log(JSON.stringify(parsed, null, 2));
                }
                process.exit(0);
            } catch (e) {
                console.error("❌ PARSE ERROR:", e.message);
                console.log("Raw response:", data);
                process.exit(1);
            }
        });
    }).on('error', (err) => {
        console.error("❌ HTTPS ERROR:", err.message);
        process.exit(1);
    });
}

listModelsRaw();

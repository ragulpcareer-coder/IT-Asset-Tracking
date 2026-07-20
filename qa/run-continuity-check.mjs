import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredPaths = [
  "backend/server.js",
  "backend/routes/authRoutes.js",
  "backend/utils/security.js",
  "frontend/src/App.jsx",
  "frontend/src/context/AuthContext.jsx",
  "frontend/src/utils/axiosConfig.js",
];

const requiredBackendEnvKeys = [
  "PORT",
  "MONGO_URI",
  "JWT_SECRET",
  "REFRESH_SECRET",
  "DB_ENCRYPTION_SECRET",
  "FRONTEND_URL",
];

let failures = 0;

for (const rel of requiredPaths) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    failures += 1;
    console.error(`[FAIL] Missing required file: ${rel}`);
  } else {
    console.log(`[OK] ${rel}`);
  }
}

const envExamplePath = path.join(root, "backend/.env.example");
if (!fs.existsSync(envExamplePath)) {
  failures += 1;
  console.error("[FAIL] backend/.env.example not found");
} else {
  const envText = fs.readFileSync(envExamplePath, "utf8");
  for (const key of requiredBackendEnvKeys) {
    if (!new RegExp(`^${key}=`, "m").test(envText)) {
      failures += 1;
      console.error(`[FAIL] Missing env key in .env.example: ${key}`);
    } else {
      console.log(`[OK] env key ${key}`);
    }
  }
}

const appText = fs.readFileSync(path.join(root, "frontend/src/App.jsx"), "utf8");
const requiredFrontendRoutes = ["/login", "/register", "/assets", "/settings"];
for (const route of requiredFrontendRoutes) {
  if (!appText.includes(route)) {
    failures += 1;
    console.error(`[FAIL] Missing frontend route reference: ${route}`);
  } else {
    console.log(`[OK] route ${route}`);
  }
}

if (failures > 0) {
  console.error(`\nContinuity check failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("\nContinuity check passed.");


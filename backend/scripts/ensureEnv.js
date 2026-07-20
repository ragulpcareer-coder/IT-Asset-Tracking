/**
 * ensureEnv.js
 *
 * Runs automatically before `npm run dev` / `npm start`. If backend/.env
 * is missing (e.g. a fresh clone, or a zip export that didn't carry a
 * previous .env), this copies .env.example to .env so the server doesn't
 * immediately crash with "Missing env var" errors, and prints a clear
 * warning that the copied values are placeholders that must be filled in
 * (MONGO_URI in particular — everything else can run with generated
 * defaults, but MONGO_URI has to point at a real database).
 *
 * This never overwrites an existing .env.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.join(__dirname, "..", ".env");
const examplePath = path.join(__dirname, "..", ".env.example");

if (fs.existsSync(envPath)) {
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.warn("[ensureEnv] No .env or .env.example found — skipping auto-setup.");
  process.exit(0);
}

let contents = fs.readFileSync(examplePath, "utf8");

// Auto-fill the three secrets that just need to be present and random —
// there's no reason to make someone generate these by hand for local dev.
const randomHex = () => crypto.randomBytes(32).toString("hex");
contents = contents
  .replace(/JWT_SECRET=.*/g, `JWT_SECRET=${randomHex()}`)
  .replace(/REFRESH_SECRET=.*/g, `REFRESH_SECRET=${randomHex()}`)
  .replace(/DB_ENCRYPTION_SECRET=.*/g, `DB_ENCRYPTION_SECRET=${randomHex()}`)
  .replace(/BACKUP_SECRET=.*/g, `BACKUP_SECRET=${randomHex()}`);

fs.writeFileSync(envPath, contents);

console.warn("\n⚠️  [ensureEnv] No .env found — created one from .env.example automatically.");
console.warn("   JWT_SECRET / REFRESH_SECRET / DB_ENCRYPTION_SECRET were auto-generated and are ready to use.");
console.warn("   You still need to set MONGO_URI to a real database (local MongoDB or MongoDB Atlas) in backend/.env.");
console.warn("   Everything else in .env is optional — see the comments in that file.\n");

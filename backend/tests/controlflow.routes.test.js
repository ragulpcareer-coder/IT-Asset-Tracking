const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const authRoutesPath = path.join(__dirname, "..", "routes", "authRoutes.js");
const source = fs.readFileSync(authRoutesPath, "utf8");

test("public auth routes stay public", () => {
  assert.match(source, /router\.post\("\/register",\s*register\);/);
  assert.match(source, /router\.post\("\/login",\s*loginLimiter,\s*login\);/);
  assert.match(source, /router\.post\("\/refresh",\s*refresh\);/);
});

test("admin routes enforce protect + admin + zeroTrust", () => {
  const guardedLines = [
    'router.get("/users", protect, admin, zeroTrust, getAllUsers);',
    'router.put("/users/:id/promote", protect, admin, zeroTrust, requireReAuth, promoteUser);',
    'router.put("/users/:id/demote", protect, admin, zeroTrust, requireReAuth, demoteUser);',
    'router.put("/users/:id/suspend", protect, admin, zeroTrust, suspendUser);',
    'router.put("/users/:id/approve", protect, admin, zeroTrust, approveUserByAdmin);',
    'router.delete("/users/:id", protect, admin, zeroTrust, requireReAuth, deleteUser);',
  ];

  for (const line of guardedLines) {
    assert.ok(source.includes(line), `Missing guard chain: ${line}`);
  }
});


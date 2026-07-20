const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const authRoutesPath = path.join(__dirname, "..", "routes", "authRoutes.js");
const source = fs.readFileSync(authRoutesPath, "utf8");

test("public auth routes stay public", () => {
  assert.match(source, /router\.post\("\/register",\s*validate\(registerSchema\),\s*register\);/);
  assert.match(source, /router\.post\("\/login",\s*loginLimiter,\s*validate\(loginSchema\),\s*login\);/);
  assert.match(source, /router\.post\("\/refresh",\s*refresh\);/);
  assert.match(source, /router\.post\("\/forgot-password",\s*validate\(forgotPasswordSchema\),\s*forgotPassword\);/);
});

test("the 2FA and admin-approval-gate system has been fully removed from auth routes", () => {
  // These must NOT reappear — normal login means no 2FA challenge and no
  // "awaiting admin approval" gate blocking a freshly registered user.
  const removedPatterns = [
    /verify-2fa/,
    /2fa\/generate/,
    /2fa\/verify/,
    /2fa\/disable/,
    /requireAdmin2FA/,
    /zeroTrust/,
    /requireReAuth/,
    /approve\/:id\/:token/,
    /users\/:id\/approve/,
    /users\/:id\/disable-2fa/,
  ];
  for (const pattern of removedPatterns) {
    assert.equal(pattern.test(source), false, `Expected ${pattern} to be absent from authRoutes.js`);
  }
});

test("admin user-management routes enforce protect + admin", () => {
  const guardedLines = [
    'router.get("/users", protect, admin, validate(paginationQuerySchema, "query"), getAllUsers);',
    'router.put("/users/:id/promote", protect, admin, validate(userIdParamsSchema, "params"), promoteUser);',
    'router.put("/users/:id/demote", protect, admin, validate(userIdParamsSchema, "params"), demoteUser);',
    'router.put("/users/:id/suspend", protect, admin, validate(userIdParamsSchema, "params"), validate(suspendUserSchema), suspendUser);',
    'router.delete("/users/:id", protect, admin, validate(userIdParamsSchema, "params"), deleteUser);',
  ];

  for (const line of guardedLines) {
    assert.ok(source.includes(line), `Missing guard chain: ${line}`);
  }
});

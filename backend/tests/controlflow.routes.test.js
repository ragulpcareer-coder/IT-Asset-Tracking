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
  assert.match(source, /router\.get\("\/approve\/:id\/:token",\s*validate\(approvalLinkParamsSchema,\s*"params"\),\s*approveUser\);/);
});

test("user 2FA routes enforce re-authentication for sensitive recovery actions", () => {
  assert.match(source, /router\.post\("\/2fa\/generate",\s*protect,\s*generate2FA\);/);
  assert.match(source, /router\.post\("\/2fa\/verify",\s*protect,\s*twoFactorLimiter,\s*validate\(twoFactorVerifySchema\),\s*verify2FA\);/);
  assert.match(source, /router\.post\("\/2fa\/recovery-codes",\s*protect,\s*requireReAuth,\s*regenerate2FARecoveryCodes\);/);
  assert.match(source, /router\.post\("\/2fa\/disable",\s*protect,\s*requireReAuth,\s*disable2FA\);/);
});

test("admin routes enforce protect + admin + requireAdmin2FA + zeroTrust", () => {
  const guardedLines = [
    'router.get("/users", protect, admin, requireAdmin2FA, zeroTrust, validate(paginationQuerySchema, "query"), getAllUsers);',
    'router.put("/users/:id/promote", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), requireReAuth, promoteUser);',
    'router.put("/users/:id/demote", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), requireReAuth, demoteUser);',
    'router.put("/users/:id/suspend", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), validate(suspendUserSchema), suspendUser);',
    'router.put("/users/:id/approve", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), approveUserByAdmin);',
    'router.delete("/users/:id", protect, admin, requireAdmin2FA, zeroTrust, validate(userIdParamsSchema, "params"), requireReAuth, deleteUser);',
  ];

  for (const line of guardedLines) {
    assert.ok(source.includes(line), `Missing guard chain: ${line}`);
  }
});


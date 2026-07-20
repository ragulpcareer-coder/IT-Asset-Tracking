const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  validatePasswordStrength,
  sanitizeInput,
  encryptSensitiveData,
  decryptSensitiveData,
  verifyRequestSignature,
  verifyToolIdentity,
} = require("../utils/security");

test("validatePasswordStrength accepts compliant passwords", () => {
  const result = validatePasswordStrength("StrongPass123!");
  assert.equal(result.isStrong, true);
  assert.equal(result.score, 5);
});

test("validatePasswordStrength rejects weak passwords", () => {
  const result = validatePasswordStrength("weak");
  assert.equal(result.isStrong, false);
  assert.ok(result.feedback.length > 0);
});

test("sanitizeInput removes unsafe tags and javascript URLs", () => {
  const clean = sanitizeInput('  <script>alert(1)</script> javascript:evil()  ');
  assert.equal(clean.includes("<"), false);
  assert.equal(clean.toLowerCase().includes("javascript:"), false);
});

test("encryptSensitiveData and decryptSensitiveData are reversible", () => {
  const payload = JSON.stringify({ id: 1, name: "asset" });
  const secret = "unit-test-secret";
  const encrypted = encryptSensitiveData(payload, secret);
  const decrypted = decryptSensitiveData(encrypted, secret);

  assert.ok(encrypted.startsWith("v2:"));
  assert.equal(decrypted, payload);
});

test("verifyRequestSignature validates matching HMAC", () => {
  const secret = "sig-secret";
  const req = {
    method: "POST",
    originalUrl: "/api/auth/login",
    body: { email: "a@example.com" },
    headers: {},
  };

  const timestamp = Date.now().toString();
  const payload = `${req.method}|${req.originalUrl}|${timestamp}|${JSON.stringify(req.body)}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  req.headers["x-request-timestamp"] = timestamp;
  req.headers["x-request-signature"] = signature;

  assert.equal(verifyRequestSignature(req, secret), true);
});

test("verifyRequestSignature rejects malformed signatures without throwing", () => {
  const req = {
    method: "GET",
    originalUrl: "/api/health",
    body: {},
    headers: {
      "x-request-timestamp": Date.now().toString(),
      "x-request-signature": "abc",
    },
  };

  assert.equal(verifyRequestSignature(req, "secret"), false);
});

test("verifyToolIdentity validates and rejects mismatched lengths", () => {
  const payload = { action: "sync" };
  const secret = "tool-secret";
  const good = crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");

  assert.equal(verifyToolIdentity(good, payload, secret), true);
  assert.equal(verifyToolIdentity("bad", payload, secret), false);
});


const test = require("node:test");
const assert = require("node:assert/strict");
const speakeasy = require("speakeasy");

const {
  TWO_FACTOR_ISSUER,
  TOTP_STEP_SECONDS,
  TOTP_WINDOW,
  MAX_2FA_FAILURES,
  generateBackupCodes,
  generateEnrollmentSecret,
  verifyTotpToken,
  consumeBackupCode,
  registerTwoFactorFailure,
  resetTwoFactorFailures,
} = require("../services/twoFactorService");

test("generateEnrollmentSecret creates a Google Authenticator compatible otpauth URL", () => {
  const enrollment = generateEnrollmentSecret("analyst@example.com");

  assert.ok(enrollment.base32);
  assert.match(enrollment.otpauthUrl, /^otpauth:\/\/totp\//);
  assert.match(enrollment.otpauthUrl, new RegExp(`issuer=${TWO_FACTOR_ISSUER}`));
  assert.match(enrollment.otpauthUrl, /algorithm=SHA1/);
  assert.match(enrollment.otpauthUrl, /digits=6/);
  assert.match(enrollment.otpauthUrl, new RegExp(`period=${TOTP_STEP_SECONDS}`));
});

test("generateBackupCodes returns 10 uppercase single-use recovery codes", () => {
  const codes = generateBackupCodes();

  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) {
    assert.match(code, /^[A-F0-9]{10}$/);
  }
});

test("verifyTotpToken accepts current token and window is one step", () => {
  const secret = speakeasy.generateSecret({ length: 32 }).base32;
  const now = Math.floor(Date.now() / 1000);

  const currentToken = speakeasy.totp({
    secret,
    encoding: "base32",
    step: TOTP_STEP_SECONDS,
    time: now,
  });

  const previousStepToken = speakeasy.totp({
    secret,
    encoding: "base32",
    step: TOTP_STEP_SECONDS,
    time: now - TOTP_STEP_SECONDS,
  });

  const farOldToken = speakeasy.totp({
    secret,
    encoding: "base32",
    step: TOTP_STEP_SECONDS,
    time: now - (TOTP_STEP_SECONDS * (TOTP_WINDOW + 2)),
  });

  assert.equal(verifyTotpToken(secret, currentToken), true);
  assert.equal(verifyTotpToken(secret, previousStepToken), true);
  assert.equal(verifyTotpToken(secret, farOldToken), false);
});

test("consumeBackupCode removes exactly one matching code", () => {
  const codes = ["ABCDEF1234", "1234ABCDEF"];
  const result = consumeBackupCode(codes, "abcdef1234");

  assert.equal(result.matched, true);
  assert.equal(result.consumedCode, "ABCDEF1234");
  assert.deepEqual(result.remainingCodes, ["1234ABCDEF"]);
});

test("registerTwoFactorFailure locks account after threshold and reset clears it", () => {
  const user = {
    failedTwoFactorAttempts: MAX_2FA_FAILURES - 1,
    twoFactorLockUntil: undefined,
  };

  const state = registerTwoFactorFailure(user);

  assert.equal(state.failures, MAX_2FA_FAILURES);
  assert.equal(state.isLocked, true);
  assert.ok(user.twoFactorLockUntil instanceof Date);

  resetTwoFactorFailures(user);
  assert.equal(user.failedTwoFactorAttempts, 0);
  assert.equal(user.twoFactorLockUntil, undefined);
});

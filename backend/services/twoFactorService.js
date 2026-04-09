const crypto = require("crypto");
const speakeasy = require("speakeasy");

const TWO_FACTOR_ISSUER = "AssetTrack";
const TOTP_STEP_SECONDS = 30;
const TOTP_WINDOW = 1;
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_BYTES = 5;
const MAX_2FA_FAILURES = 5;
const TWO_FACTOR_LOCK_MINUTES = 15;

const generateBackupCodes = (count = BACKUP_CODE_COUNT) => (
  Array.from({ length: count }, () => crypto.randomBytes(BACKUP_CODE_BYTES).toString("hex").toUpperCase())
);

const generateEnrollmentSecret = (email) => {
  const label = `${TWO_FACTOR_ISSUER}:${email}`;
  const secret = speakeasy.generateSecret({
    issuer: TWO_FACTOR_ISSUER,
    name: label,
    length: 32,
  });

  const otpauthUrl = speakeasy.otpauthURL({
    secret: secret.base32,
    label,
    issuer: TWO_FACTOR_ISSUER,
    encoding: "base32",
    algorithm: "sha1",
    digits: 6,
    step: TOTP_STEP_SECONDS,
  });

  return {
    base32: secret.base32,
    otpauthUrl: otpauthUrl.includes("period=")
      ? otpauthUrl
      : `${otpauthUrl}&period=${TOTP_STEP_SECONDS}`,
  };
};

const verifyTotpToken = (secret, token) => speakeasy.totp.verify({
  secret,
  encoding: "base32",
  token: String(token || "").trim(),
  window: TOTP_WINDOW,
  step: TOTP_STEP_SECONDS,
});

const consumeBackupCode = (codes = [], token) => {
  const normalized = String(token || "").trim().toUpperCase();
  const match = codes.find((code) => code === normalized);
  if (!match) {
    return { matched: false, remainingCodes: codes };
  }

  return {
    matched: true,
    consumedCode: match,
    remainingCodes: codes.filter((code) => code !== match),
  };
};

const registerTwoFactorFailure = (user) => {
  const failures = (user.failedTwoFactorAttempts || 0) + 1;
  user.failedTwoFactorAttempts = failures;

  if (failures >= MAX_2FA_FAILURES) {
    user.twoFactorLockUntil = new Date(Date.now() + TWO_FACTOR_LOCK_MINUTES * 60 * 1000);
  }

  return {
    failures,
    isLocked: Boolean(user.twoFactorLockUntil && user.twoFactorLockUntil > new Date()),
  };
};

const resetTwoFactorFailures = (user) => {
  user.failedTwoFactorAttempts = 0;
  user.twoFactorLockUntil = undefined;
};

module.exports = {
  TWO_FACTOR_ISSUER,
  TOTP_STEP_SECONDS,
  TOTP_WINDOW,
  BACKUP_CODE_COUNT,
  MAX_2FA_FAILURES,
  TWO_FACTOR_LOCK_MINUTES,
  generateBackupCodes,
  generateEnrollmentSecret,
  verifyTotpToken,
  consumeBackupCode,
  registerTwoFactorFailure,
  resetTwoFactorFailures,
};

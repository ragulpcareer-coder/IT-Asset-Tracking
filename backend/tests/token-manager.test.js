const test = require("node:test");
const assert = require("node:assert/strict");
const TokenManager = require("../utils/tokenManager");

test("TokenManager generates and verifies token pair", () => {
  const tm = new TokenManager("access-secret", "refresh-secret");
  const pair = tm.generateTokenPair("user-1", "Admin", 2);

  assert.ok(pair.accessToken);
  assert.ok(pair.refreshToken);

  const access = tm.verifyAccessToken(pair.accessToken);
  const refresh = tm.verifyRefreshToken(pair.refreshToken);

  assert.equal(access.valid, true);
  assert.equal(refresh.valid, true);
  assert.equal(access.decoded.userId, "user-1");
  assert.equal(access.decoded.tokenVersion, 2);
  assert.equal(refresh.decoded.type, "refresh");
});

test("TokenManager rotation keeps same family", () => {
  const tm = new TokenManager("access-secret", "refresh-secret");
  const initial = tm.generateTokenPair("user-2", "Employee", 0);
  const rotated = tm.rotateRefreshToken("user-2", "Employee", initial.refreshTokenFamily);

  assert.equal(rotated.refreshTokenFamily, initial.refreshTokenFamily);
  assert.ok(rotated.accessToken);
  assert.ok(rotated.refreshToken);
});


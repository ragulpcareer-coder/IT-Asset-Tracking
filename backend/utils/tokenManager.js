const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * Enhanced Token Manager with Refresh Token Rotation
 * Implements JWT best practices:
 * - Short-lived access tokens (15 mins)
 * - Long-lived refresh tokens (7 days) with rotation
 * - Token family tracking to prevent token reuse attacks
 * - Revocation support
 */

class TokenManager {
  constructor(accessSecret, refreshSecret) {
    this._explicitAccessSecret = accessSecret;
    this._explicitRefreshSecret = refreshSecret;
    this.accessTokenExpiry = "15m"; // Short-lived access token
    this.refreshTokenExpiry = "7d"; // Long-lived refresh token
    this.algorithm = "HS256";
    this.issuer = "it-asset-tracker";
    this.audience = "it-asset-tracker-client";
  }

  get accessSecret() {
    return this._explicitAccessSecret || process.env.JWT_SECRET;
  }

  get refreshSecret() {
    return this._explicitRefreshSecret || process.env.REFRESH_SECRET;
  }

  assertSecretsPresent() {
    if (!this.accessSecret || !this.refreshSecret) {
      throw new Error("JWT secrets are not configured");
    }
  }

  /**
   * Generate access token (Short-lived, 15 minutes)
   */
  generateAccessToken(userId, role, tokenVersion = 0) {
    this.assertSecretsPresent();
    return jwt.sign(
      { userId, role, type: "access", tokenVersion },
      this.accessSecret,
      {
        expiresIn: this.accessTokenExpiry,
        algorithm: this.algorithm,
        issuer: this.issuer,
        audience: this.audience,
        subject: String(userId),
      }
    );
  }

  /**
   * Generate refresh token (Long-lived, 7 days)
   * Includes family ID for rotation tracking
   */
  generateRefreshToken(userId, role, familyId = null) {
    this.assertSecretsPresent();
    const tokenId = crypto.randomBytes(16).toString("hex");
    const family = familyId || tokenId; // Track token family for rotation

    return {
      token: jwt.sign(
        {
          userId,
          role,
          type: "refresh",
          tokenId,
          family,
        },
        this.refreshSecret,
        {
          expiresIn: this.refreshTokenExpiry,
          algorithm: this.algorithm,
          issuer: this.issuer,
          audience: this.audience,
          subject: String(userId),
        }
      ),
      tokenId,
      family,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };
  }

  /**
   * Generate token pair (access + refresh)
   * Use this on login
   */
  generateTokenPair(userId, role, tokenVersion = 0) {
    const accessToken = this.generateAccessToken(userId, role, tokenVersion);
    const refreshTokenData = this.generateRefreshToken(userId, role);

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      refreshTokenId: refreshTokenData.tokenId,
      refreshTokenFamily: refreshTokenData.family,
      accessTokenExpiry: this.accessTokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry,
    };
  }

  /**
   * Rotate refresh token (issue new token pair)
   * Use this when access token expires
   * Returns new access + refresh tokens
   */
  rotateRefreshToken(userId, role, oldFamilyId, tokenVersion = 0) {
    // Generate new token pair with same family ID
    // This maintains token family lineage for rotation tracking
    const accessToken = this.generateAccessToken(userId, role, tokenVersion);
    const refreshTokenData = this.generateRefreshToken(
      userId,
      role,
      oldFamilyId
    );

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      refreshTokenId: refreshTokenData.tokenId,
      refreshTokenFamily: refreshTokenData.family,
      rotatedAt: new Date(),
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    try {
      this.assertSecretsPresent();
      const decoded = jwt.verify(token, this.accessSecret, {
        algorithms: [this.algorithm],
        issuer: this.issuer,
        audience: this.audience,
      });
      if (decoded.type !== "access") {
        throw new Error("Invalid token type");
      }
      return { valid: true, decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token) {
    try {
      this.assertSecretsPresent();
      const decoded = jwt.verify(token, this.refreshSecret, {
        algorithms: [this.algorithm],
        issuer: this.issuer,
        audience: this.audience,
      });
      if (decoded.type !== "refresh") {
        throw new Error("Invalid token type");
      }
      return { valid: true, decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) return true;
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  /**
   * Get time until token expiry
   */
  getTokenTimeToLive(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) return 0;
      return Math.max(0, decoded.exp * 1000 - Date.now());
    } catch {
      return 0;
    }
  }
}

module.exports = TokenManager;

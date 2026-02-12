const crypto = require("crypto");

/**
 * Audit Log Tamper Protection
 * 
 * Implements cryptographic verification to detect tampering:
 * - HMAC signing of audit logs
 * - Blockchain-style chaining (each log references previous hash)
 * - Integrity verification on read
 * - Tamper detection and alerts
 */

class AuditLogSecurity {
  /**
   * Generate HMAC signature for audit log
   * Uses SHA-256 with secret key
   */
  static generateSignature(logData, secret) {
    const payload = JSON.stringify(logData);
    return crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
  }

  /**
   * Create tamper-protected audit log entry
   * Includes hash chain reference for blockchain-style verification
   */
  static createTamperProtectedLog(logData, previousLogHash = null, secret) {
    const secret_key = secret || process.env.AUDIT_SECRET || "audit-secret";

    // Generate hash for this log entry
    const currentHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(logData) + Date.now())
      .digest("hex");

    // Generate HMAC signature
    const signature = this.generateSignature(logData, secret_key);

    const protectedLog = {
      ...logData,
      _security: {
        hash: currentHash,
        signature,
        previousHash: previousLogHash || null,
        chainValid: true,
        signedAt: new Date(),
        signatureVersion: "1.0",
      },
    };

    return protectedLog;
  }

  /**
   * Verify audit log integrity
   * Returns { valid: boolean, tampered: boolean, reason: string }
   */
  static verifyLogIntegrity(logEntry, secret) {
    const secret_key = secret || process.env.AUDIT_SECRET || "audit-secret";

    try {
      if (!logEntry._security) {
        return {
          valid: false,
          tampered: true,
          reason: "Missing security metadata",
        };
      }

      // Extract security data
      const { signature, hash, previousHash } = logEntry._security;

      // Create comparison log (without security metadata)
      const { _security, ...logData } = logEntry;

      // Verify HMAC signature
      const expectedSignature = this.generateSignature(logData, secret_key);

      if (signature !== expectedSignature) {
        return {
          valid: false,
          tampered: true,
          reason: "HMAC signature mismatch - log may have been modified",
        };
      }

      return {
        valid: true,
        tampered: false,
        reason: "Log integrity verified",
        hash,
        previousHash,
        signedAt: logEntry._security.signedAt,
      };
    } catch (error) {
      return {
        valid: false,
        tampered: true,
        reason: error.message,
      };
    }
  }

  /**
   * Verify chain integrity (blockchain-style verification)
   * Verifies that logs form an unbroken chain
   */
  static verifyChainIntegrity(logArray, secret) {
    const secret_key = secret || process.env.AUDIT_SECRET || "audit-secret";

    let previousHash = null;
    const results = [];

    for (let i = 0; i < logArray.length; i++) {
      const log = logArray[i];
      const integrityCheck = this.verifyLogIntegrity(log, secret_key);

      // Check if previousHash matches
      const chainValid =
        i === 0 || log._security?.previousHash === previousHash;

      results.push({
        index: i,
        id: log._id,
        integrityValid: integrityCheck.valid && integrityCheck.tampered === false,
        chainValid,
        tampered: !integrityCheck.valid || !chainValid,
        reason:
          !integrityCheck.valid ? integrityCheck.reason : chainValid ? "OK" : "Chain broken",
      });

      previousHash = log._security?.hash;

      // If chain is broken, flag it
      if (!chainValid) {
        results[i].chainBroken = true;
      }
    }

    const allValid = results.every((r) => r.integrityValid && r.chainValid);

    return {
      allValid,
      checkCount: logArray.length,
      tamperedCount: results.filter((r) => r.tampered).length,
      results,
    };
  }

  /**
   * Detect tampering patterns
   * Identifies suspicious modifications
   */
  static detectTamperingPatterns(logArray) {
    const patterns = {
      deletedEntries: 0,
      modifiedTimestamps: 0,
      signatureMismatches: 0,
      chainBreaks: 0,
    };

    for (let i = 0; i < logArray.length - 1; i++) {
      const current = logArray[i];
      const next = logArray[i + 1];

      // Check for time reversal (suspicious)
      if (current.createdAt > next.createdAt) {
        patterns.modifiedTimestamps++;
      }

      // Check for chain breaks
      if (current._security?.hash !== next._security?.previousHash) {
        patterns.chainBreaks++;
      }
    }

    return {
      suspicious: Object.values(patterns).some((v) => v > 0),
      patterns,
      riskScore: Object.values(patterns).reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Generate audit integrity report
   * Comprehensive tamper detection report
   */
  static generateIntegrityReport(logArray, secret) {
    const chainVerification = this.verifyChainIntegrity(logArray, secret);
    const tamperingAnalysis = this.detectTamperingPatterns(logArray);

    return {
      timestamp: new Date(),
      logsChecked: logArray.length,
      integritySummary: {
        allValid: chainVerification.allValid,
        tamperedCount: chainVerification.tamperedCount,
        chainValid: !tamperingAnalysis.suspicious,
      },
      tamperingAnalysis,
      verification: chainVerification,
      riskLevel:
        tamperingAnalysis.riskScore > 5
          ? "HIGH"
          : tamperingAnalysis.riskScore > 2
            ? "MEDIUM"
            : "LOW",
      recommendations: this.getRecommendations(
        chainVerification,
        tamperingAnalysis
      ),
    };
  }

  /**
   * Get security recommendations based on analysis
   */
  static getRecommendations(chainVerification, tamperingAnalysis) {
    const recommendations = [];

    if (chainVerification.tamperedCount > 0) {
      recommendations.push(
        "Alert: Tampered entries detected. Investigate before proceeding."
      );
    }

    if (tamperingAnalysis.patterns.chainBreaks > 0) {
      recommendations.push(
        "Critical: Chain integrity broken. Possible deletion or reordering of entries."
      );
    }

    if (tamperingAnalysis.patterns.modifiedTimestamps > 0) {
      recommendations.push(
        "Warning: Suspicious timestamp patterns detected. Manual review recommended."
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("All audit logs verified. No tampering detected.");
    }

    return recommendations;
  }
}

module.exports = AuditLogSecurity;

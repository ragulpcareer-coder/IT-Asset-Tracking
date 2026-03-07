/**
 * Threat Intelligence Service
 * Provides reputation checks for IP addresses and domains.
 * In a production system, this would integrate with AbuseIPDB, AlienVault OTX, or CrowdStrike.
 */
class ThreatIntelService {
    constructor() {
        // Mock list of malicious IP ranges/patterns
        this.maliciousRanges = [
            /^185\..*/,    // Example range
            /^103\.44\.*/, // Example from simulation
            /^192\.168\.50\..*/ // Local test "malicious" subnet
        ];

        this.maliciousIps = new Set([
            "1.1.1.1",       // Cloudflare DNS (mocked as malicious for demo)
            "45.33.22.11",   // Mock Botnet C2
            "185.34.22.11"   // Mock Proxy/VPN
        ]);
    }

    /**
     * Check if an IP address is known to be malicious.
     * @param {string} ip 
     * @returns {Promise<Object>}
     */
    async checkIpReputation(ip) {
        console.log(`[ThreatIntel] Checking reputation for ${ip}...`);

        let isMalicious = this.maliciousIps.has(ip);

        if (!isMalicious) {
            isMalicious = this.maliciousRanges.some(range => range.test(ip));
        }

        if (isMalicious) {
            return {
                isMalicious: true,
                score: 85,
                category: "Malware/Botnet",
                provider: "Elite Intelligence Feed"
            };
        }

        return {
            isMalicious: false,
            score: 0,
            category: "Clean",
            provider: "Elite Intelligence Feed"
        };
    }
}

module.exports = new ThreatIntelService();

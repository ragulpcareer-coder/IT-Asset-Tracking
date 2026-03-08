const logger = require('./logger');
const { isPrivateIp, normalizeIp } = require("./clientIp");

const intelCache = new Map();
const INTEL_CACHE_TTL_MS = 15 * 60 * 1000;

const getUnknownGeo = () => ({
    country: "Unknown",
    city: "Unknown",
    lat: 0,
    lon: 0,
    provider: "none",
    ipType: "UNKNOWN",
    geoConfidence: "low",
    asn: "Unknown",
    isp: "Unknown",
    org: "Unknown",
    abuseScore: 0,
    intelConfidence: "low"
});

const getInternalGeo = () => ({
    country: "Internal/Local",
    city: "Localhost",
    lat: 0,
    lon: 0,
    provider: "internal",
    ipType: "PRIVATE",
    geoConfidence: "none",
    asn: "Private Network",
    isp: "Internal",
    org: "Internal",
    abuseScore: 0,
    intelConfidence: "high"
});

const normalizeAbuseScore = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric < 0) return 0;
    if (numeric > 100) return 100;
    return Math.round(numeric);
};

const fetchAbuseIntel = async (ip) => {
    const apiKey = process.env.ABUSEIPDB_API_KEY;
    if (!apiKey) {
        return { abuseScore: 0, intelProvider: "none" };
    }

    try {
        const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`, {
            headers: {
                Accept: "application/json",
                Key: apiKey
            }
        });

        if (!response.ok) {
            return { abuseScore: 0, intelProvider: "abuseipdb" };
        }

        const payload = await response.json();
        const score = normalizeAbuseScore(payload?.data?.abuseConfidenceScore);
        return { abuseScore: score, intelProvider: "abuseipdb" };
    } catch (error) {
        logger.warn(`[GeoIP] AbuseIPDB lookup failed for ${ip}: ${error.message}`);
        return { abuseScore: 0, intelProvider: "abuseipdb" };
    }
};

const getGeoLocation = async (ip) => {
    const normalizedIp = normalizeIp(ip);
    if (!normalizedIp || normalizedIp === "unknown") {
        return getUnknownGeo();
    }

    if (isPrivateIp(normalizedIp)) {
        return getInternalGeo();
    }

    const cached = intelCache.get(normalizedIp);
    if (cached && Date.now() - cached.ts < INTEL_CACHE_TTL_MS) {
        return cached.value;
    }

    // PRIMARY PROVIDER: ipapi.co
    try {
        const response = await fetch(`https://ipapi.co/${normalizedIp}/json/`);
        if (response.ok) {
            const data = await response.json();
            if (!data.error) {
                const abuseIntel = await fetchAbuseIntel(normalizedIp);
                const geo = {
                    country: data.country_name || "Unknown",
                    city: data.city || "Unknown",
                    lat: data.latitude || 0,
                    lon: data.longitude || 0,
                    provider: "ipapi",
                    ipType: "PUBLIC",
                    geoConfidence: "high",
                    asn: data.asn || "Unknown",
                    isp: data.org || data.org_name || "Unknown",
                    org: data.org || "Unknown",
                    abuseScore: abuseIntel.abuseScore,
                    intelConfidence: abuseIntel.intelProvider === "abuseipdb" ? "high" : "medium"
                };
                intelCache.set(normalizedIp, { ts: Date.now(), value: geo });
                return geo;
            }
        }
    } catch (e) {
        console.warn(`[GeoIP] Primary provider failed: ${e.message}`);
    }

    // FALLBACK PROVIDER: ip-api.com (Rate limited but reliable for low volume)
    try {
        const response = await fetch(`http://ip-api.com/json/${normalizedIp}`);
        if (response.ok) {
            const data = await response.json();
            if (data.status === "success") {
                const abuseIntel = await fetchAbuseIntel(normalizedIp);
                const geo = {
                    country: data.country || "Unknown",
                    city: data.city || "Unknown",
                    lat: data.lat || 0,
                    lon: data.lon || 0,
                    provider: "ip-api",
                    ipType: "PUBLIC",
                    geoConfidence: "medium",
                    asn: data.as || "Unknown",
                    isp: data.isp || "Unknown",
                    org: data.org || "Unknown",
                    abuseScore: abuseIntel.abuseScore,
                    intelConfidence: abuseIntel.intelProvider === "abuseipdb" ? "medium" : "low"
                };
                intelCache.set(normalizedIp, { ts: Date.now(), value: geo });
                return geo;
            }
        }
    } catch (e) {
        console.error(`[GeoIP] Fallback provider failed: ${e.message}`);
    }

    const fallback = {
        ...getUnknownGeo(),
        ipType: "PUBLIC"
    };
    intelCache.set(normalizedIp, { ts: Date.now(), value: fallback });
    return fallback;
};

module.exports = { getGeoLocation };

const logger = require('./logger');
const { isPrivateIp, normalizeIp } = require("./clientIp");

const getGeoLocation = async (ip) => {
    const normalizedIp = normalizeIp(ip);
    if (!normalizedIp || normalizedIp === "unknown") {
        return { country: "Unknown", city: "Unknown", lat: 0, lon: 0, ipType: "UNKNOWN", geoConfidence: "low" };
    }

    if (isPrivateIp(normalizedIp)) {
        return { country: "Internal/Local", city: "Localhost", lat: 0, lon: 0, ipType: "PRIVATE", geoConfidence: "none" };
    }

    // PRIMARY PROVIDER: ipapi.co
    try {
        const response = await fetch(`https://ipapi.co/${normalizedIp}/json/`);
        if (response.ok) {
            const data = await response.json();
            if (!data.error) {
                return {
                    country: data.country_name || "Unknown",
                    city: data.city || "Unknown",
                    lat: data.latitude || 0,
                    lon: data.longitude || 0,
                    provider: "ipapi",
                    ipType: "PUBLIC",
                    geoConfidence: "high"
                };
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
                return {
                    country: data.country || "Unknown",
                    city: data.city || "Unknown",
                    lat: data.lat || 0,
                    lon: data.lon || 0,
                    provider: "ip-api",
                    ipType: "PUBLIC",
                    geoConfidence: "medium"
                };
            }
        }
    } catch (e) {
        console.error(`[GeoIP] Fallback provider failed: ${e.message}`);
    }

    return { country: "Unknown", city: "Unknown", lat: 0, lon: 0, ipType: "PUBLIC", geoConfidence: "low" };
};

module.exports = { getGeoLocation };

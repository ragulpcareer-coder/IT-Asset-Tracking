const logger = require('./logger');

const getGeoLocation = async (ip) => {
    const isPrivate = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
    if (isPrivate || !ip) {
        return { country: "Internal/Local", city: "Localhost", lat: 0, lon: 0 };
    }

    // PRIMARY PROVIDER: ipapi.co
    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        if (response.ok) {
            const data = await response.json();
            if (!data.error) {
                return {
                    country: data.country_name || "Unknown",
                    city: data.city || "Unknown",
                    lat: data.latitude || 0,
                    lon: data.longitude || 0,
                    provider: "ipapi"
                };
            }
        }
    } catch (e) {
        console.warn(`[GeoIP] Primary provider failed: ${e.message}`);
    }

    // FALLBACK PROVIDER: ip-api.com (Rate limited but reliable for low volume)
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        if (response.ok) {
            const data = await response.json();
            if (data.status === "success") {
                return {
                    country: data.country || "Unknown",
                    city: data.city || "Unknown",
                    lat: data.lat || 0,
                    lon: data.lon || 0,
                    provider: "ip-api"
                };
            }
        }
    } catch (e) {
        console.error(`[GeoIP] Fallback provider failed: ${e.message}`);
    }

    return { country: "Unknown", city: "Unknown", lat: 0, lon: 0 };
};

module.exports = { getGeoLocation };

const logger = require('./logger');

const getGeoLocation = async (ip) => {
    // If IP is local, don't ping external API
    const isPrivate = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
    if (isPrivate || !ip) {
        return { country: "Internal/Local", city: "Localhost" };
    }

    try {
        // We use native fetch (available in Node 18+)
        const response = await fetch(`https://ipapi.co/${ip}/json/`);

        if (!response.ok) {
            throw new Error(`GeoIP API responded with ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`GeoIP API Error: ${data.reason}`);
        }

        return {
            country: data.country_name || "Unknown",
            city: data.city || "Unknown",
        };
    } catch (error) {
        logger.error(`GeoIP lookup failed for IP ${ip}: ${error.message}`);
        return { country: "Unknown", city: "Unknown" };
    }
};

module.exports = { getGeoLocation };

const cron = require('node-cron');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Keep-Alive Service to prevent Render Free Tier from sleeping
 * Pings itself every 10 minutes to maintain active state.
 */
cron.schedule('*/10 * * * *', async () => {
    const backendUrl = process.env.BACKEND_URL || 'https://it-asset-tracking.onrender.com';

    try {
        const res = await axios.get(`${backendUrl}/health`);
        if (res.status === 200) {
            logger.info(`[Keep-Alive] Pulse check successful: ${res.status}`);
        }
    } catch (err) {
        logger.warn(`[Keep-Alive] Pulse check skipped or errored: ${err.message}`);
    }
});

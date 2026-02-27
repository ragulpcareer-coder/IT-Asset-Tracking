const cron = require('node-cron');
const https = require('https');
const http = require('http');
const logger = require('../utils/logger');

// Native ping helper – no external dependencies needed
const pingUrl = (url) => new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
        res.resume(); // discard body
        resolve(res.statusCode);
    }).on('error', reject);
});

/**
 * Keep-Alive Service to prevent Render Free Tier from sleeping
 * Pings itself every 10 minutes to maintain active state.
 */
cron.schedule('*/10 * * * *', async () => {
    const backendUrl = process.env.BACKEND_URL || 'https://it-asset-tracking.onrender.com';

    try {
        const statusCode = await pingUrl(`${backendUrl}/health`);
        if (statusCode === 200) {
            logger.info(`[Keep-Alive] Pulse check successful: ${statusCode}`);
        }
    } catch (err) {
        logger.warn(`[Keep-Alive] Pulse check skipped or errored: ${err.message}`);
    }
});

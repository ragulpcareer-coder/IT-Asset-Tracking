const winston = require('winston');

// 10/10 Enterprise Upgrade: SIEM Integration (Elastic Stack, Splunk, Wazuh)
// Generates standardized JSON logs suitable for ingestion by SIEMs.
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json() // Forces logs into JSON for easy SIEM parsing
    ),
    defaultMeta: { service: 'it-asset-tracker-backend' },
    transports: [
        // Output standard general activities to application log
        new winston.transports.File({ filename: 'logs/application.log' }),
        // Explicit separate transport for SECURITY INCIDENTS
        new winston.transports.File({ filename: 'logs/security-events.log', level: 'warn' }),
    ],
});

// If we're not in production then log to the `console` as well using simple format
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

module.exports = logger;

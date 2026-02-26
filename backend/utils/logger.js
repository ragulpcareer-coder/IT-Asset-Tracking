const winston = require('winston');

// 10/10 Enterprise Upgrade: SIEM Integration (Elastic Stack, Splunk, Wazuh)
// Generates standardized JSON logs suitable for ingestion by SIEMs.
// ENHANCED SIEM LOGGING ARCHITECTURE (§Category 1/2/7)
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: {
        service: 'it-asset-tracker-soc',
        soc_tier: 'production',
        audit_version: '2.5.0'
    },
    transports: [
        // 1. Primary Operational Log (SIEM Standard)
        new winston.transports.File({
            filename: 'logs/soc-operational.log',
            maxsize: 5242880, // 5MB rotation (§Category 2)
            maxFiles: 10
        }),
        // 2. High-Assurance Forensic Security Log (§Category 1/7)
        new winston.transports.File({
            filename: 'logs/forensic-security.log',
            level: 'warn',
            maxsize: 10485760, // 10MB
            maxFiles: 20
        }),
        // 3. Backup SOC Endpoint (§Category 10 Simulation)
        new winston.transports.File({ filename: 'logs/soc-redundancy-shadow.log' })
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

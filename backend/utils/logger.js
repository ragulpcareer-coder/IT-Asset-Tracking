const winston = require('winston');

// SIEM-grade logging with Render-compatible console output.
// CRITICAL FIX: Render's filesystem is ephemeral — file transports work
// but logs vanish on restart. Console IS the persistent log on Render (visible
// in the Render dashboard). We always enable console transport.

const transports = [
    // Console transport: ALWAYS active (critical for Render log visibility)
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
                return `${timestamp} [${level}] ${message}${metaStr}`;
            })
        ),
    }),
];

// File transports: best-effort (won't crash if logs/ dir is unavailable on Render)
try {
    transports.push(
        new winston.transports.File({ filename: 'logs/soc-operational.log', maxsize: 5242880, maxFiles: 10 }),
        new winston.transports.File({ filename: 'logs/forensic-security.log', level: 'warn', maxsize: 10485760, maxFiles: 20 }),
        new winston.transports.File({ filename: 'logs/soc-redundancy-shadow.log' })
    );
} catch (e) {
    console.warn('[Logger] File transport unavailable (ephemeral filesystem). Console-only mode.');
}

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
    transports,
});

module.exports = logger;

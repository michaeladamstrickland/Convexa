import winston from 'winston';
import 'winston-mail'; // Import winston-mail to register the Mail transport
const { combine, timestamp, errors, json, colorize, simple } = winston.format;
export const logger = winston.createLogger({
    level: 'info',
    format: combine(timestamp(), errors({ stack: true }), json()),
    defaultMeta: { service: 'convexa-ai' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: combine(colorize(), simple())
        }),
        new winston.transports.Mail({
            level: 'error', // Only send emails for error level logs
            to: process.env.ALERT_TO_LIST,
            from: process.env.ALERT_FROM,
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            username: process.env.SMTP_USER,
            password: process.env.SMTP_PASS,
            ssl: true, // Use SSL/TLS
            html: true, // Send HTML emails
            subject: 'Convexa AI Alert: {{level}} - {{message}}',
            // Add a throttle to prevent too many emails
            // This is a basic throttle, more advanced throttling might be needed
            // For now, we'll rely on the rate-limit in the alert manager for specific alerts.
            // This transport will send an email for every 'error' log.
        })
    ]
});
//# sourceMappingURL=logger.js.map
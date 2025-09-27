// Logger with Redaction
// Ensures sensitive data is never logged in plain text

const sensitiveFields = [
  'password', 'token', 'secret', 'key', 'auth', 'credential',
  'authorization', 'x-api-key', 'cookie', 'session'
];

function redactSensitiveData(obj, depth = 0) {
  if (depth > 10) return '[MAX_DEPTH]'; // Prevent infinite recursion
  
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1));
  }
  
  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field => keyLower.includes(field));
    
    if (isSensitive) {
      if (typeof value === 'string') {
        redacted[key] = value.length > 0 ? '[REDACTED]' : '';
      } else {
        redacted[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveData(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

class SafeLogger {
  constructor(baseLogger = console) {
    this.baseLogger = baseLogger;
  }
  
  info(message, data = {}) {
    this.baseLogger.log(message, redactSensitiveData(data));
  }
  
  error(message, data = {}) {
    this.baseLogger.error(message, redactSensitiveData(data));
  }
  
  warn(message, data = {}) {
    this.baseLogger.warn(message, redactSensitiveData(data));
  }
  
  debug(message, data = {}) {
    this.baseLogger.debug(message, redactSensitiveData(data));
  }
}

// Usage:
// const logger = new SafeLogger();
// logger.info('User login', { username: 'john', password: 'secret123' });
// // Logs: User login { username: 'john', password: '[REDACTED]' }

module.exports = { SafeLogger, redactSensitiveData };
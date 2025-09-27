#!/usr/bin/env node

/**
 * Metrics and Logging Audit
 * Ensures every mutation route has HTTP counters with {method,route,status}
 * Verifies redaction is applied in logger
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

/**
 * Load routes inventory to identify mutation routes
 */
function loadRoutesInventory() {
  const routesPath = path.join(repoRoot, 'ops', 'findings', 'routes_inventory.json');
  if (!fs.existsSync(routesPath)) {
    throw new Error('routes_inventory.json not found. Run routesInventory.mjs first.');
  }
  
  const inventory = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  return inventory.routes;
}

/**
 * Check if a route is a mutation route (modifies state)
 */
function isMutationRoute(route) {
  const mutationMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  return mutationMethods.includes(route.method);
}

/**
 * Scan files for metrics usage patterns
 */
function scanForMetrics() {
  const metricsPatterns = [
    // Prometheus-style metrics
    /metrics\.(counter|histogram|gauge|summary)\(|\.inc\(|\.observe\(/g,
    // HTTP request/response counters
    /http_(requests?|responses?)_(total|count|duration)/g,
    // Custom counter patterns
    /Counter\(|\.increment\(|\.count\(/g,
    // Express middleware metrics
    /prometheus-?middleware|express-?prometheus/g
  ];

  const serverFiles = [
    'backend/integrated-server.js',
    'backend/src/server.ts',
    'backend/src/server-master.ts',
    'src/server.ts',
    'app.js'
  ];

  const findings = {
    metricsLibraries: [],
    httpCounterPatterns: [],
    customMetrics: [],
    middlewareUsage: []
  };

  for (const file of serverFiles) {
    const filePath = path.join(repoRoot, file);
    if (!fs.existsSync(filePath)) continue;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmed = line.trim();

        // Check for metrics imports/requires
        if (trimmed.includes('prometheus') || trimmed.includes('metrics')) {
          findings.metricsLibraries.push({
            file,
            line: lineNumber,
            content: trimmed
          });
        }

        // Check for HTTP counter patterns
        for (const pattern of metricsPatterns) {
          const matches = [...trimmed.matchAll(pattern)];
          for (const match of matches) {
            if (trimmed.includes('http')) {
              findings.httpCounterPatterns.push({
                file,
                line: lineNumber,
                content: trimmed,
                pattern: match[0]
              });
            } else {
              findings.customMetrics.push({
                file,
                line: lineNumber,
                content: trimmed,
                pattern: match[0]
              });
            }
          }
        }

        // Check for middleware usage
        if (trimmed.includes('app.use') && (trimmed.includes('metrics') || trimmed.includes('prometheus'))) {
          findings.middlewareUsage.push({
            file,
            line: lineNumber,
            content: trimmed
          });
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not scan ${file}:`, error.message);
    }
  }

  return findings;
}

/**
 * Check individual route handlers for metrics
 */
function checkRouteMetrics(routes) {
  const serverFile = path.join(repoRoot, 'backend/integrated-server.js');
  if (!fs.existsSync(serverFile)) {
    return { error: 'backend/integrated-server.js not found' };
  }

  const content = fs.readFileSync(serverFile, 'utf8');
  const lines = content.split('\n');

  const routeChecks = [];

  for (const route of routes) {
    if (!isMutationRoute(route)) continue;

    const routeCheck = {
      method: route.method,
      path: route.path,
      lineNumber: route.lineNumber,
      hasMetrics: false,
      metricsType: null,
      metricsLocation: null,
      codeSnippet: null
    };

    // Look around the route definition for metrics
    const startLine = Math.max(0, route.lineNumber - 10);
    const endLine = Math.min(lines.length, route.lineNumber + 50);

    for (let i = startLine; i < endLine; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Look for various metrics patterns
      if (trimmed.includes('.inc(') || 
          trimmed.includes('.increment(') ||
          trimmed.includes('counter.') ||
          trimmed.includes('metrics.') ||
          trimmed.includes('httpRequestCounter') ||
          trimmed.includes('prometheus.')) {
        
        routeCheck.hasMetrics = true;
        routeCheck.metricsLocation = i + 1;
        routeCheck.codeSnippet = trimmed;
        
        if (trimmed.includes('method') && trimmed.includes('route') && trimmed.includes('status')) {
          routeCheck.metricsType = 'complete';
        } else {
          routeCheck.metricsType = 'partial';
        }
        break;
      }
    }

    routeChecks.push(routeCheck);
  }

  return routeChecks;
}

/**
 * Scan for logging usage and redaction patterns
 */
function scanForLoggingRedaction() {
  const logFiles = [
    'src/logger.js',
    'src/logger.ts', 
    'backend/logger.js',
    'backend/src/logger.js',
    'backend/src/logger.ts',
    'shared/logger.js',
    'shared/logger.ts'
  ];

  const findings = {
    loggerFound: false,
    loggerPath: null,
    redactionPatterns: [],
    sensitiveFieldRedaction: [],
    securityIssues: []
  };

  for (const logFile of logFiles) {
    const filePath = path.join(repoRoot, logFile);
    if (!fs.existsSync(filePath)) continue;

    findings.loggerFound = true;
    findings.loggerPath = logFile;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmed = line.trim();

        // Check for redaction patterns
        if (trimmed.includes('redact') || 
            trimmed.includes('sanitize') ||
            trimmed.includes('mask') ||
            trimmed.includes('obfuscate')) {
          findings.redactionPatterns.push({
            line: lineNumber,
            content: trimmed
          });
        }

        // Check for sensitive field handling
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
        for (const field of sensitiveFields) {
          if (trimmed.toLowerCase().includes(field) && 
              (trimmed.includes('redact') || trimmed.includes('***') || trimmed.includes('[REDACTED]'))) {
            findings.sensitiveFieldRedaction.push({
              field,
              line: lineNumber,
              content: trimmed
            });
          }
        }

        // Check for potential security issues (logging sensitive data)
        if (trimmed.includes('console.log') || trimmed.includes('logger.')) {
          for (const field of sensitiveFields) {
            if (trimmed.toLowerCase().includes(field) && 
                !trimmed.includes('redact') && 
                !trimmed.includes('***') &&
                !trimmed.includes('[REDACTED]')) {
              findings.securityIssues.push({
                issue: `Potentially logging sensitive field: ${field}`,
                line: lineNumber,
                content: trimmed
              });
            }
          }
        }
      });

    } catch (error) {
      console.warn(`Warning: Could not scan ${logFile}:`, error.message);
    }
  }

  return findings;
}

/**
 * Generate metrics middleware template
 */
function generateMetricsMiddleware() {
  return `// HTTP Metrics Middleware
// Add this to your Express server setup

const prometheus = require('prom-client');

// Create HTTP request counter
const httpRequestCounter = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Create HTTP request duration histogram  
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Metrics middleware
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = (Date.now() - startTime) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    
    // Increment request counter
    httpRequestCounter.inc({
      method: req.method,
      route: route,
      status_code: res.statusCode
    });
    
    // Record request duration
    httpRequestDuration.observe({
      method: req.method,
      route: route
    }, duration);
    
    originalEnd.apply(this, args);
  };
  
  next();
}

// Add to your express app:
// app.use(metricsMiddleware);

// Expose metrics endpoint:
// app.get('/metrics', (req, res) => {
//   res.set('Content-Type', prometheus.register.contentType);
//   res.end(prometheus.register.metrics());
// });

module.exports = { metricsMiddleware, httpRequestCounter, httpRequestDuration };`;
}

/**
 * Generate logger redaction template
 */
function generateLoggerRedactionTemplate() {
  return `// Logger with Redaction
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

module.exports = { SafeLogger, redactSensitiveData };`;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔍 Starting metrics and logging audit...');
    
    // Load routes inventory
    const routes = loadRoutesInventory();
    const mutationRoutes = routes.filter(isMutationRoute);
    
    console.log(`📊 Found ${mutationRoutes.length} mutation routes to audit`);

    // Scan for existing metrics
    console.log('🔍 Scanning for existing metrics implementation...');
    const metricsFindings = scanForMetrics();
    
    // Check route-specific metrics
    console.log('🔍 Checking mutation routes for metrics...');
    const routeMetrics = checkRouteMetrics(routes);
    
    // Scan for logging redaction
    console.log('🔍 Scanning for logging redaction patterns...');
    const loggingFindings = scanForLoggingRedaction();

    // Generate report
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalRoutes: routes.length,
        mutationRoutes: mutationRoutes.length,
        routesWithMetrics: routeMetrics.filter(r => r.hasMetrics).length,
        metricsLibrariesFound: metricsFindings.metricsLibraries.length,
        loggerFound: loggingFindings.loggerFound,
        redactionPatternsFound: loggingFindings.redactionPatterns.length,
        securityIssuesFound: loggingFindings.securityIssues.length
      },
      mutationRoutes: mutationRoutes.map(route => ({
        method: route.method,
        path: route.path,
        authGate: route.authGate,
        metricsLabel: route.metricsLabel
      })),
      routeMetricsCheck: routeMetrics,
      metricsImplementation: metricsFindings,
      loggingAudit: loggingFindings,
      recommendations: []
    };

    // Generate recommendations
    if (metricsFindings.httpCounterPatterns.length === 0) {
      report.recommendations.push({
        type: 'metrics',
        priority: 'high',
        issue: 'No HTTP request counters found',
        solution: 'Implement HTTP metrics middleware with {method,route,status} labels'
      });
    }

    if (routeMetrics.filter(r => r.hasMetrics).length < mutationRoutes.length) {
      const missing = routeMetrics.filter(r => !r.hasMetrics);
      report.recommendations.push({
        type: 'metrics',
        priority: 'high', 
        issue: `${missing.length} mutation routes lack metrics`,
        solution: 'Add metrics instrumentation to all mutation routes',
        missingRoutes: missing.map(r => `${r.method} ${r.path}`)
      });
    }

    if (!loggingFindings.loggerFound) {
      report.recommendations.push({
        type: 'logging',
        priority: 'medium',
        issue: 'No centralized logger found',
        solution: 'Implement centralized logging with redaction'
      });
    }

    if (loggingFindings.redactionPatterns.length === 0) {
      report.recommendations.push({
        type: 'logging',
        priority: 'high',
        issue: 'No redaction patterns found in logger',
        solution: 'Implement sensitive data redaction in logging'
      });
    }

    if (loggingFindings.securityIssues.length > 0) {
      report.recommendations.push({
        type: 'security',
        priority: 'critical',
        issue: `${loggingFindings.securityIssues.length} potential sensitive data logging issues`,
        solution: 'Review and fix sensitive data logging',
        issues: loggingFindings.securityIssues
      });
    }

    // Write report
    const reportPath = path.join(repoRoot, 'ops', 'findings', 'metrics_logging_audit.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Metrics and logging audit report written to: ${path.relative(repoRoot, reportPath)}`);

    // Write templates if needed
    if (metricsFindings.httpCounterPatterns.length === 0) {
      const metricsTemplatePath = path.join(repoRoot, 'ops', 'templates', 'metricsMiddleware.js');
      fs.mkdirSync(path.dirname(metricsTemplatePath), { recursive: true });
      fs.writeFileSync(metricsTemplatePath, generateMetricsMiddleware());
      console.log(`📝 Created metrics middleware template: ${path.relative(repoRoot, metricsTemplatePath)}`);
    }

    if (loggingFindings.redactionPatterns.length === 0) {
      const loggingTemplatePath = path.join(repoRoot, 'ops', 'templates', 'safeLogger.js');
      fs.mkdirSync(path.dirname(loggingTemplatePath), { recursive: true });
      fs.writeFileSync(loggingTemplatePath, generateLoggerRedactionTemplate());
      console.log(`📝 Created logging redaction template: ${path.relative(repoRoot, loggingTemplatePath)}`);
    }

    // Summary output
    console.log('\\n✅ Metrics and logging audit completed!');
    console.log(`   - ${report.summary.mutationRoutes} mutation routes audited`);
    console.log(`   - ${report.summary.routesWithMetrics} routes have metrics`);
    console.log(`   - ${report.summary.metricsLibrariesFound} metrics libraries found`);
    console.log(`   - Logger found: ${report.summary.loggerFound}`);
    console.log(`   - ${report.summary.redactionPatternsFound} redaction patterns found`);
    console.log(`   - ${report.summary.securityIssuesFound} security issues found`);

    if (report.recommendations.length > 0) {
      console.log('\\n📋 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`   - [${rec.priority.toUpperCase()}] ${rec.issue}`);
        console.log(`     Solution: ${rec.solution}`);
      });
    }

  } catch (error) {
    console.error('❌ Metrics and logging audit failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scanForMetrics, checkRouteMetrics, scanForLoggingRedaction };
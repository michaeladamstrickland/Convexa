/**
 * Deprecation middleware for marking routes as deprecated
 * Follows RFC 8594 for Deprecation header format
 */

const deprecationLogs = new Set();

/**
 * Create deprecation middleware for a route
 * @param {Object} options - Deprecation options
 * @param {string} options.version - Version when deprecated
 * @param {string} options.sunset - ISO date string for sunset
 * @param {string} options.replacement - URL or path to replacement
 * @param {string} options.reason - Reason for deprecation
 */
export function createDeprecationMiddleware(options = {}) {
  const {
    version = 'PI0-APP-1',
    sunset,
    replacement,
    reason = 'Route deprecated'
  } = options;

  return function deprecationMiddleware(req, res, next) {
    const routeKey = `${req.method}:${req.path}`;
    
    // Log once per process to avoid spam
    if (!deprecationLogs.has(routeKey)) {
      console.warn(`[Deprecation] Route ${routeKey} is deprecated since ${version}. ${reason}`);
      if (replacement) {
        console.warn(`[Deprecation] Use ${replacement} instead`);
      }
      deprecationLogs.add(routeKey);
    }

    // Set deprecation headers
    res.set('Deprecation', 'true');
    if (sunset) {
      const sunsetDate = new Date(sunset).toUTCString();
      res.set('Sunset', sunsetDate);
    }
    if (replacement) {
      res.set('Link', `<${replacement}>; rel="successor-version"`);
    }
    
    next();
  };
}

/**
 * Common deprecation configurations
 */
export const DEPRECATIONS = {
  ZIP_SEARCH_OLD: {
    version: 'PI0-APP-1',
    sunset: '2025-12-01T00:00:00Z',
    replacement: '/api/zip-search-new/search',
    reason: 'Replaced by improved search API'
  },
  LEGACY_IMPORT: {
    version: 'PI0-APP-1',
    sunset: '2025-12-01T00:00:00Z',
    replacement: '/admin/import/csv',
    reason: 'Consolidated into admin namespace'
  }
};
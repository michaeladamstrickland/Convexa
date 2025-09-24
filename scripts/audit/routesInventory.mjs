#!/usr/bin/env node

/**
 * Route Inventory Audit
 * Parses backend/integrated-server.js to extract all routes with metadata
 * Outputs to ops/findings/routes_inventory.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const LEGACY_ROUTE_MAP = {
  // Define legacy routes that should emit deprecation warnings
  '/api/zip-search': '/api/zip-search-new',
  '/legacy-import': '/admin/import/csv',
  // Add more as needed
};

/**
 * Parse the integrated server file for route definitions
 */
async function parseRoutes() {
  const serverPath = path.join(repoRoot, 'backend', 'integrated-server.js');
  
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Server file not found at: ${serverPath}`);
  }

  const content = fs.readFileSync(serverPath, 'utf8');
  const routes = [];

  // Regex patterns to match Express route definitions
  const routePatterns = [
    // app.get('/path', ...)
    /app\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]\s*,?/g,
    // router.get('/path', ...)  
    /router\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]\s*,?/g,
    // express.static and middleware routes
    /\.use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*express\.static/g,
  ];

  let lineNumber = 0;
  const lines = content.split('\n');

  for (const line of lines) {
    lineNumber++;
    
    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const [, method, route] = match;
        
        if (!method || !route) continue;
        if (route.includes('*') || route.includes(':')) {
          // Skip wildcard and dynamic routes for now
          continue;
        }

        // Determine auth requirements by looking at surrounding context
        const authGate = determineAuthGate(content, lineNumber, route);
        
        // Determine metrics label
        const metricsLabel = generateMetricsLabel(method, route);
        
        // Check if this is a legacy route
        const isLegacy = Object.keys(LEGACY_ROUTE_MAP).includes(route);
        const deprecatedIn = isLegacy ? 'PI0-APP-1' : null;
        const replacement = isLegacy ? LEGACY_ROUTE_MAP[route] : null;

        routes.push({
          method: method.toUpperCase(),
          path: route,
          authGate,
          metricsLabel,
          lineNumber,
          isLegacy,
          deprecatedIn,
          replacement,
          addedIn: 'PI0-APP-1', // Default for now, could be enhanced
        });
      }
    }
  }

  // Remove duplicates and sort
  const uniqueRoutes = routes.reduce((acc, route) => {
    const key = `${route.method}:${route.path}`;
    if (!acc.has(key)) {
      acc.set(key, route);
    }
    return acc;
  }, new Map());

  return Array.from(uniqueRoutes.values()).sort((a, b) => {
    if (a.path === b.path) {
      return a.method.localeCompare(b.method);
    }
    return a.path.localeCompare(b.path);
  });
}

/**
 * Determine authentication requirements for a route
 */
function determineAuthGate(content, lineNumber, route) {
  const lines = content.split('\n');
  const contextStart = Math.max(0, lineNumber - 5);
  const contextEnd = Math.min(lines.length - 1, lineNumber + 5);
  const context = lines.slice(contextStart, contextEnd).join(' ').toLowerCase();

  if (route.startsWith('/admin') || context.includes('basicauth')) {
    return 'basic-auth';
  }
  if (context.includes('auth') || context.includes('jwt') || context.includes('token')) {
    return 'token-auth';
  }
  if (route.startsWith('/api') && !route.includes('/health') && !route.includes('/metrics')) {
    return 'api-key';
  }
  
  return 'none';
}

/**
 * Generate consistent metrics label for a route
 */
function generateMetricsLabel(method, route) {
  // Convert path to metrics-friendly format
  const cleanPath = route
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\/+$/, '') // Remove trailing slashes
    .replace(/[/:]/g, '_') // Replace slashes and colons with underscores
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove special chars
    .toLowerCase();
  
  return cleanPath ? `${method.toLowerCase()}_${cleanPath}` : `${method.toLowerCase()}_root`;
}

/**
 * Generate API surface documentation
 */
function generateApiSurfaceDoc(routes) {
  const groupedRoutes = routes.reduce((acc, route) => {
    const category = getRouteCategory(route.path);
    if (!acc[category]) acc[category] = [];
    acc[category].push(route);
    return acc;
  }, {});

  let markdown = `# API Surface\n\n`;
  markdown += `Generated on: ${new Date().toISOString()}\n\n`;
  markdown += `Total routes: ${routes.length}\n\n`;

  // Summary stats
  const authStats = routes.reduce((acc, r) => {
    acc[r.authGate] = (acc[r.authGate] || 0) + 1;
    return acc;
  }, {});

  markdown += `## Authentication Summary\n\n`;
  Object.entries(authStats).forEach(([auth, count]) => {
    markdown += `- **${auth}**: ${count} routes\n`;
  });

  markdown += `\n## Routes by Category\n\n`;

  Object.entries(groupedRoutes).forEach(([category, categoryRoutes]) => {
    markdown += `### ${category}\n\n`;
    markdown += `| Method | Path | Auth | Metrics Label | Status |\n`;
    markdown += `|--------|------|------|---------------|--------|\n`;
    
    categoryRoutes.forEach(route => {
      const status = route.isLegacy ? '⚠️ Deprecated' : '✅ Active';
      markdown += `| ${route.method} | ${route.path} | ${route.authGate} | ${route.metricsLabel} | ${status} |\n`;
    });
    
    markdown += `\n`;
  });

  // Deprecated routes section
  const legacyRoutes = routes.filter(r => r.isLegacy);
  if (legacyRoutes.length > 0) {
    markdown += `## Deprecated Routes\n\n`;
    markdown += `| Path | Replacement | Deprecated In |\n`;
    markdown += `|------|-------------|---------------|\n`;
    
    legacyRoutes.forEach(route => {
      markdown += `| ${route.path} | ${route.replacement || 'N/A'} | ${route.deprecatedIn} |\n`;
    });
    
    markdown += `\n`;
  }

  return markdown;
}

/**
 * Categorize routes for documentation
 */
function getRouteCategory(path) {
  if (path.startsWith('/admin')) return 'Admin';
  if (path.startsWith('/api/attom')) return 'ATTOM Data';
  if (path.startsWith('/api/zip-search')) return 'Search';
  if (path.startsWith('/api')) return 'API';
  if (path.startsWith('/ops')) return 'Operations';
  if (path.startsWith('/metrics') || path.startsWith('/health')) return 'Monitoring';
  if (path === '/' || path.includes('static')) return 'Static/UI';
  return 'Other';
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔍 Parsing routes from integrated-server.js...');
    const serverPath = path.join(repoRoot, 'backend', 'integrated-server.js');
    console.log(`📂 Looking for server at: ${serverPath}`);
    console.log(`📂 Server exists: ${fs.existsSync(serverPath)}`);
    
    const routes = await parseRoutes();
    
    console.log(`📊 Found ${routes.length} routes`);
    routes.slice(0, 5).forEach(route => {
      console.log(`   - ${route.method} ${route.path} (${route.authGate})`);
    });
    
    // Write routes inventory JSON
    const outputPath = path.join(repoRoot, 'ops', 'findings', 'routes_inventory.json');
    console.log(`📄 Writing to: ${outputPath}`);
    
    const inventory = {
      generatedAt: new Date().toISOString(),
      totalRoutes: routes.length,
      routes,
      summary: {
        byMethod: routes.reduce((acc, r) => {
          acc[r.method] = (acc[r.method] || 0) + 1;
          return acc;
        }, {}),
        byAuth: routes.reduce((acc, r) => {
          acc[r.authGate] = (acc[r.authGate] || 0) + 1;
          return acc;
        }, {}),
        legacyCount: routes.filter(r => r.isLegacy).length,
      }
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2));
    console.log(`📄 Routes inventory written to: ${outputPath}`);
    
    // Generate and write API surface documentation
    const docsPath = path.join(repoRoot, 'docs', 'API_SURFACE.md');
    console.log(`📚 Writing docs to: ${docsPath}`);
    const apiDoc = generateApiSurfaceDoc(routes);
    fs.mkdirSync(path.dirname(docsPath), { recursive: true });
    fs.writeFileSync(docsPath, apiDoc);
    console.log(`📚 API surface documentation written to: ${docsPath}`);
    
    console.log('\n✅ Route inventory completed successfully!');
    console.log(`   - ${routes.length} total routes discovered`);
    console.log(`   - ${routes.filter(r => r.isLegacy).length} legacy routes marked for deprecation`);
    console.log(`   - ${Object.keys(inventory.summary.byAuth).length} different auth patterns`);
    
  } catch (error) {
    console.error('❌ Route inventory failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Also run if called directly
if (process.argv[1]?.endsWith('routesInventory.mjs')) {
  main();
}

export { parseRoutes, generateApiSurfaceDoc };
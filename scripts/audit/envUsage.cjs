#!/usr/bin/env node

/**
 * Environment Usage Audit
 * Scans for process.env.* usage across the codebase
 * Generates ops/findings/env_report.json and updates .env.example
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['src', 'backend', 'shared', 'scripts'];
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /\.test\./,
  /\.spec\./
];

/**
 * Scan files for process.env usage
 */
function scanForEnvUsage() {
  const envUsage = new Map();
  const allFiles = [];

  // Collect all relevant files
  for (const dir of SCAN_DIRS) {
    const dirPath = path.join(repoRoot, dir);
    if (fs.existsSync(dirPath)) {
      scanDirectory(dirPath, allFiles);
    }
  }

  console.log(`🔍 Scanning ${allFiles.length} files for environment variable usage...`);

  // Regex patterns for environment variable usage
  const patterns = [
    // process.env.VAR_NAME
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    // process.env['VAR_NAME'] or process.env["VAR_NAME"]
    /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    // destructuring: { VAR_NAME } = process.env
    /{\s*([A-Z_][A-Z0-9_]*(?:\s*,\s*[A-Z_][A-Z0-9_]*)*)\s*}\s*=\s*process\.env/g
  ];

  for (const filePath of allFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(repoRoot, filePath);
      let lineNumber = 0;

      const lines = content.split('\n');
      
      for (const line of lines) {
        lineNumber++;
        
        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(line)) !== null) {
            let envVars = [];
            
            if (match[1].includes(',')) {
              // Handle destructuring
              envVars = match[1].split(',').map(v => v.trim());
            } else {
              envVars = [match[1]];
            }

            for (const envVar of envVars) {
              if (!envUsage.has(envVar)) {
                envUsage.set(envVar, []);
              }
              
              envUsage.get(envVar).push({
                file: relativePath,
                line: lineNumber,
                context: line.trim(),
                type: determineEnvVarType(envVar, line)
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan ${filePath}:`, error.message);
    }
  }

  return envUsage;
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath, files) {
  if (!fs.existsSync(dirPath)) return;

  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    
    if (shouldIgnore(fullPath)) continue;

    try {
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath, files);
      } else if (stat.isFile() && isRelevantFile(fullPath)) {
        files.push(fullPath);
      }
    } catch (error) {
      console.warn(`Warning: Could not stat ${fullPath}:`, error.message);
    }
  }
}

/**
 * Check if file should be ignored
 */
function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if file is relevant for scanning
 */
function isRelevantFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext);
}

/**
 * Determine the type/category of environment variable
 */
function determineEnvVarType(envVar, context) {
  const varLower = envVar.toLowerCase();
  const contextLower = context.toLowerCase();

  if (varLower.includes('secret') || varLower.includes('key') || varLower.includes('token') || 
      varLower.includes('password') || varLower.includes('pass')) {
    return 'secret';
  }
  
  if (varLower.includes('url') || varLower.includes('endpoint') || varLower.includes('host')) {
    return 'url';
  }
  
  if (varLower.includes('port')) {
    return 'port';
  }
  
  if (varLower.includes('db') || varLower.includes('database')) {
    return 'database';
  }
  
  if (varLower.includes('redis') || varLower.includes('cache')) {
    return 'cache';
  }
  
  if (varLower.includes('email') || varLower.includes('smtp')) {
    return 'email';
  }
  
  if (varLower.includes('mode') || varLower.includes('env') || varLower.includes('environment')) {
    return 'config';
  }

  if (contextLower.includes('||') && (contextLower.includes("'") || contextLower.includes('"'))) {
    return 'config'; // Has default value
  }
  
  return 'other';
}

/**
 * Generate recommended default values for environment variables
 */
function generateDefaultValue(envVar, type, usages) {
  const varLower = envVar.toLowerCase();
  
  switch (type) {
    case 'secret':
      return `# ${envVar}=your_${varLower}_here`;
    case 'url':
      if (varLower.includes('redis')) return 'redis://localhost:6379';
      if (varLower.includes('database') || varLower.includes('db')) return 'sqlite:./data/database.db';
      return `https://api.example.com`;
    case 'port':
      if (varLower.includes('redis')) return '6379';
      if (varLower.includes('db')) return '5432';
      return '3000';
    case 'database':
      if (varLower.includes('sqlite')) return './data/database.db';
      return 'postgresql://user:pass@localhost:5432/dbname';
    case 'cache':
      return 'redis://localhost:6379';
    case 'email':
      if (varLower.includes('host')) return 'smtp.gmail.com';
      if (varLower.includes('port')) return '587';
      if (varLower.includes('user')) return 'your-email@gmail.com';
      return 'your-email@gmail.com';
    case 'config':
      if (varLower.includes('mode')) return 'development';
      if (varLower.includes('debug')) return 'false';
      if (varLower.includes('demo')) return 'true';
      
      // Try to extract default from usage context
      for (const usage of usages) {
        const match = usage.context.match(new RegExp(`${envVar}\\s*\\|\\|\\s*['"]([^'"]+)['"]`));
        if (match) return match[1];
      }
      return 'value';
    default:
      return 'value';
  }
}

/**
 * Load existing .env.example file
 */
function loadExistingEnvExample() {
  const envExamplePath = path.join(repoRoot, '.env.example');
  const existing = new Map();
  
  if (fs.existsSync(envExamplePath)) {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        existing.set(key.trim(), valueParts.join('=').trim());
      }
    }
  }
  
  return existing;
}

/**
 * Generate updated .env.example content
 */
function generateEnvExample(envUsage, existing) {
  const sections = new Map();
  const documented = new Set();
  
  // Group environment variables by type
  for (const [envVar, usages] of envUsage.entries()) {
    const type = usages[0].type;
    if (!sections.has(type)) {
      sections.set(type, []);
    }
    
    const defaultValue = existing.has(envVar) 
      ? existing.get(envVar) 
      : generateDefaultValue(envVar, type, usages);
    
    sections.get(type).push({
      name: envVar,
      value: defaultValue,
      usageCount: usages.length,
      files: [...new Set(usages.map(u => u.file))],
      type
    });
    
    documented.add(envVar);
  }

  // Keep existing variables not found in code
  for (const [key, value] of existing.entries()) {
    if (!documented.has(key)) {
      if (!sections.has('legacy')) {
        sections.set('legacy', []);
      }
      sections.get('legacy').push({
        name: key,
        value: value,
        usageCount: 0,
        files: [],
        type: 'legacy'
      });
    }
  }

  // Generate content
  let content = '# Environment Configuration\n';
  content += '# Generated by envUsage audit\n\n';

  const typeOrder = ['config', 'secret', 'database', 'cache', 'url', 'port', 'email', 'other', 'legacy'];
  const typeLabels = {
    config: 'Application Configuration',
    secret: 'Secrets and API Keys',
    database: 'Database Configuration',
    cache: 'Cache Configuration',
    url: 'Service URLs',
    port: 'Port Configuration', 
    email: 'Email Configuration',
    other: 'Other Configuration',
    legacy: 'Legacy Variables (not found in code)'
  };

  for (const type of typeOrder) {
    if (!sections.has(type)) continue;
    
    const vars = sections.get(type);
    content += `# ${typeLabels[type]}\n`;
    
    for (const envVar of vars.sort((a, b) => a.name.localeCompare(b.name))) {
      if (envVar.usageCount > 0) {
        content += `# Used in: ${envVar.files.slice(0, 3).join(', ')}${envVar.files.length > 3 ? '...' : ''}\n`;
      }
      content += `${envVar.name}=${envVar.value}\n`;
    }
    
    content += '\n';
  }

  return content;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔍 Starting environment variable usage audit...');
    
    const envUsage = scanForEnvUsage();
    const existing = loadExistingEnvExample();
    
    // Generate report data
    const report = {
      generatedAt: new Date().toISOString(),
      totalVariables: envUsage.size,
      variablesByType: {},
      variables: {},
      summary: {
        secretVariables: 0,
        configVariables: 0,
        urlVariables: 0,
        missingInExample: []
      }
    };

    // Process usage data
    for (const [envVar, usages] of envUsage.entries()) {
      const type = usages[0].type;
      
      if (!report.variablesByType[type]) {
        report.variablesByType[type] = 0;
      }
      report.variablesByType[type]++;
      
      report.variables[envVar] = {
        type,
        usageCount: usages.length,
        files: [...new Set(usages.map(u => u.file))],
        usages: usages.map(u => ({
          file: u.file,
          line: u.line,
          context: u.context
        })),
        inExample: existing.has(envVar),
        recommendedValue: generateDefaultValue(envVar, type, usages)
      };

      // Update summary
      if (type === 'secret') report.summary.secretVariables++;
      if (type === 'config') report.summary.configVariables++;
      if (type === 'url') report.summary.urlVariables++;
      if (!existing.has(envVar)) {
        report.summary.missingInExample.push(envVar);
      }
    }

    // Write report
    const reportPath = path.join(repoRoot, 'ops', 'findings', 'env_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Environment report written to: ${reportPath}`);

    // Update .env.example
    const envExampleContent = generateEnvExample(envUsage, existing);
    const envExamplePath = path.join(repoRoot, '.env.example');
    fs.writeFileSync(envExamplePath, envExampleContent);
    console.log(`📝 Updated .env.example: ${envExamplePath}`);

    // Summary output
    console.log('\\n✅ Environment audit completed!');
    console.log(`   - ${envUsage.size} environment variables found`);
    console.log(`   - ${report.summary.secretVariables} secret variables`);
    console.log(`   - ${report.summary.missingInExample.length} missing from .env.example`);
    
    if (report.summary.missingInExample.length > 0) {
      console.log('\\n📋 Missing from .env.example:');
      report.summary.missingInExample.slice(0, 5).forEach(envVar => {
        console.log(`   - ${envVar}`);
      });
    }

    // Security warnings
    const secrets = Object.entries(report.variables)
      .filter(([, info]) => info.type === 'secret')
      .map(([name]) => name);
    
    if (secrets.length > 0) {
      console.log('\\n🔒 Secret variables found:');
      secrets.forEach(secret => {
        console.log(`   - ${secret} (ensure this has a secure default)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Environment audit failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scanForEnvUsage, generateEnvExample };
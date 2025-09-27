#!/usr/bin/env node

/**
 * Duplicate File Finder
 * Scans src/, backend/, shared/ directories for duplicate files based on content hash
 * Outputs results to ops/findings/dupes.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const SCAN_DIRS = ['src', 'backend', 'shared'];
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /\.nyc_output/,
  /\.(log|tmp|temp)$/,
  /package-lock\.json$/,
  /yarn\.lock$/
];

/**
 * Calculate SHA-256 hash of file content
 */
function calculateFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (error) {
    console.warn(`Warning: Could not hash file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Check if file should be ignored
 */
function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => 
    typeof pattern === 'string' ? filePath.includes(pattern) : pattern.test(filePath)
  );
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    
    if (shouldIgnore(fullPath)) {
      continue;
    }

    try {
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath, files);
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    } catch (error) {
      console.warn(`Warning: Could not stat ${fullPath}:`, error.message);
    }
  }

  return files;
}

/**
 * Find duplicates by content hash
 */
function findDuplicates() {
  const fileHashMap = new Map();
  const allFiles = [];

  // Scan all specified directories
  for (const dir of SCAN_DIRS) {
    const dirPath = path.join(repoRoot, dir);
    const files = scanDirectory(dirPath);
    allFiles.push(...files);
  }

  console.log(`🔍 Scanning ${allFiles.length} files for duplicates...`);

  // Calculate hashes and group by hash
  for (const filePath of allFiles) {
    const hash = calculateFileHash(filePath);
    if (!hash) continue;

    const relativePath = path.relative(repoRoot, filePath);
    const fileInfo = {
      path: relativePath,
      size: fs.statSync(filePath).size,
      extension: path.extname(filePath),
      basename: path.basename(filePath)
    };

    if (!fileHashMap.has(hash)) {
      fileHashMap.set(hash, []);
    }
    fileHashMap.get(hash).push(fileInfo);
  }

  // Find duplicates (groups with more than one file)
  const duplicates = [];
  for (const [hash, files] of fileHashMap.entries()) {
    if (files.length > 1) {
      duplicates.push({
        hash,
        count: files.length,
        size: files[0].size,
        files: files.map(f => ({
          path: f.path,
          extension: f.extension,
          basename: f.basename
        }))
      });
    }
  }

  return {
    scanStats: {
      totalFiles: allFiles.length,
      duplicateGroups: duplicates.length,
      duplicateFiles: duplicates.reduce((sum, group) => sum + group.count, 0),
      potentialSavings: duplicates.reduce((sum, group) => sum + (group.size * (group.count - 1)), 0)
    },
    duplicates: duplicates.sort((a, b) => {
      // Sort by potential savings (size * duplicate count)
      const aSavings = a.size * (a.count - 1);
      const bSavings = b.size * (b.count - 1);
      return bSavings - aSavings;
    })
  };
}

/**
 * Generate analysis report
 */
function generateReport(results) {
  const { scanStats, duplicates } = results;
  
  let report = '# Duplicate Files Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total files scanned**: ${scanStats.totalFiles}\n`;
  report += `- **Duplicate groups**: ${scanStats.duplicateGroups}\n`;
  report += `- **Duplicate files**: ${scanStats.duplicateFiles}\n`;
  report += `- **Potential space savings**: ${(scanStats.potentialSavings / 1024).toFixed(1)} KB\n\n`;

  if (duplicates.length === 0) {
    report += '✅ No duplicate files found!\n';
    return report;
  }

  report += '## Duplicate Files\n\n';
  
  duplicates.forEach((group, index) => {
    const savings = group.size * (group.count - 1);
    report += `### Group ${index + 1} (${group.count} files, ${(savings / 1024).toFixed(1)} KB potential savings)\n\n`;
    report += `**Hash**: \`${group.hash.substring(0, 16)}...\`\n`;
    report += `**Size**: ${group.size} bytes\n\n`;
    
    group.files.forEach(file => {
      report += `- \`${file.path}\`\n`;
    });
    
    report += '\n';
  });

  return report;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔍 Starting duplicate file analysis...');
    
    const results = findDuplicates();
    
    // Write JSON results
    const jsonPath = path.join(repoRoot, 'ops', 'findings', 'dupes.json');
    const jsonData = {
      generatedAt: new Date().toISOString(),
      ...results
    };
    
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log(`📄 Duplicate analysis written to: ${jsonPath}`);
    
    // Write readable report
    const reportPath = path.join(repoRoot, 'ops', 'findings', 'dupes_report.md');
    const report = generateReport(results);
    fs.writeFileSync(reportPath, report);
    console.log(`📚 Duplicate report written to: ${reportPath}`);
    
    // Summary output
    console.log('\n✅ Duplicate analysis completed!');
    console.log(`   - ${results.scanStats.totalFiles} files scanned`);
    console.log(`   - ${results.scanStats.duplicateGroups} duplicate groups found`);
    console.log(`   - ${results.scanStats.duplicateFiles} total duplicate files`);
    console.log(`   - ${(results.scanStats.potentialSavings / 1024).toFixed(1)} KB potential savings`);

    if (results.duplicates.length > 0) {
      console.log('\n📋 Top duplicates:');
      results.duplicates.slice(0, 3).forEach((group, index) => {
        const savings = group.size * (group.count - 1);
        console.log(`   ${index + 1}. ${group.count} copies of ${group.files[0].basename} (${(savings / 1024).toFixed(1)} KB)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Duplicate analysis failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1]?.endsWith('dupeFinder.mjs')) {
  main();
}

export { findDuplicates, calculateFileHash };
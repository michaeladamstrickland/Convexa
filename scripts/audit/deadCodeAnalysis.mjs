#!/usr/bin/env node

/**
 * Dead Code Analysis
 * Uses knip to detect unused dependencies and exports
 * Outputs results to ops/findings/dep_unused.json
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function ensureFindingsDir() {
  const findingsDir = path.join(repoRoot, 'ops', 'findings');
  if (!fs.existsSync(findingsDir)) {
    fs.mkdirSync(findingsDir, { recursive: true });
  }
  return findingsDir;
}

async function runDeadCodeAnalysis() {
  const findingsDir = ensureFindingsDir();
  const outputFile = path.join(findingsDir, 'dep_unused_ci.json');
  
  console.log('🔍 Running dead code analysis with knip...');
  
  let analysisResult = {
    status: 'initial_state',
    message: 'Dead code analysis started',
    files: []
  };

  // Always write an initial state to ensure the file exists
  fs.writeFileSync(outputFile, JSON.stringify(analysisResult, null, 2));
  console.log(`📄 Initial state saved to: ${path.relative(repoRoot, outputFile)}`);

  try {
    const { execSync } = await import('child_process');
    
    const knipOutput = execSync('npx knip --config knip.json --reporter json', {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 60000, // Increased timeout
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    try {
      analysisResult = JSON.parse(knipOutput);
      if (analysisResult.files === undefined) {
        analysisResult.files = [];
      }
      analysisResult.status = 'analysis_completed';
      analysisResult.message = 'Dead code analysis completed successfully';
      console.log('✅ Dead code analysis completed successfully');
    } catch (parseError) {
      analysisResult = {
        status: 'analysis_completed_with_parse_error',
        rawOutput: knipOutput.substring(0, 1000),
        parseError: parseError.message,
        files: []
      };
      console.log('⚠️ Dead code analysis completed but output parsing failed');
    }
    
    fs.writeFileSync(outputFile, JSON.stringify(analysisResult, null, 2));
    console.log(`📄 Final results saved to: ${path.relative(repoRoot, outputFile)}`);
    
    return analysisResult;
    
  } catch (error) {
    console.log('⚠️ Dead code analysis encountered issues during execution:', error.message);
    
    analysisResult = {
      status: 'execution_failed',
      error: error.message,
      message: 'Dead code analysis failed during execution',
      timestamp: new Date().toISOString(),
      files: []
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(analysisResult, null, 2));
    console.log(`📄 Fallback results saved to: ${path.relative(repoRoot, outputFile)}`);
    
    return analysisResult;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDeadCodeAnalysis()
    .then(() => process.exit(0))
    .catch(() => process.exit(0)); // Don't fail the build for dead code analysis issues
}

export { runDeadCodeAnalysis };

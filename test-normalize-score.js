/**
 * test-normalize-score.js
 * Simple test for address normalization and lead scoring
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and evaluate the modules directly
const normalizePath = path.join(__dirname, 'src', 'lib', 'normalize.js');
const scorePath = path.join(__dirname, 'src', 'scoring', 'leadScore.js');

// Read files
const normalizeContent = fs.readFileSync(normalizePath, 'utf8');
const scoreContent = fs.readFileSync(scorePath, 'utf8');

// Create modules
const normalizeModule = { exports: {} };
const scoreModule = { exports: {} };

// Mock require for CommonJS modules
const mockRequire = (module) => {
  if (module === 'crypto') {
    return {
      createHash: (algo) => {
        return {
          update: (str) => {
            return {
              digest: (format) => {
                // Simple mock hash function
                return `mock-hash-${str.length}`;
              }
            };
          }
        };
      }
    };
  }
  return {};
};

// Evaluate modules
const normalizeFunc = new Function('module', 'exports', 'require', normalizeContent);
const scoreFunc = new Function('module', 'exports', 'require', scoreContent);

normalizeFunc(normalizeModule, normalizeModule.exports, mockRequire);
scoreFunc(scoreModule, scoreModule.exports, mockRequire);

// Extract functions
const { normalizeAddress, normalizeOwnerName } = normalizeModule.exports;
const { scoreLead, temperature } = scoreModule.exports;

// Test address normalization
console.log('Testing address normalization...');
const addresses = [
  '123 Main St, Chicago, IL 60601',
  '123 Main Street, Chicago, Illinois 60601',
  '123 Main Street Apartment 4B, Chicago, IL 60601'
];

for (const addr of addresses) {
  const normalized = normalizeAddress(addr);
  console.log(`Original: ${addr}`);
  console.log(`Normalized: ${normalized.normalized}`);
  console.log(`Hash: ${normalized.hash}`);
  console.log('---');
}

// Test owner name normalization
console.log('\nTesting owner name normalization...');
const names = [
  'John Smith',
  'John Smith Jr.',
  'JOHN SMITH TRUST',
  'SMITH FAMILY LIVING TRUST',
  'ACME PROPERTIES LLC'
];

for (const name of names) {
  const normalized = normalizeOwnerName(name);
  console.log(`Original: ${name}`);
  console.log(`Normalized: ${normalized}`);
  console.log('---');
}

// Test lead scoring
console.log('\nTesting lead scoring...');
const leads = [
  {
    address: { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' },
    distressSignals: ['PRE_FORECLOSURE'],
    lastEventDate: new Date().toISOString()
  },
  {
    address: { line1: '456 Oak Ave', city: 'Chicago', state: 'IL', zip: '60602' },
    distressSignals: ['TAX_DELINQUENT', 'AUCTION'],
    lastEventDate: new Date(Date.now() - 30 * 86400000).toISOString(),
    ownerMailingZip: '90210',
    contacts: [{ type: 'phone', value: '555-123-4567' }]
  }
];

for (const lead of leads) {
  const score = scoreLead(lead);
  const temp = temperature(score);
  console.log(`Lead: ${lead.address.line1}`);
  console.log(`Score: ${score}`);
  console.log(`Temperature: ${temp}`);
  console.log('---');
}

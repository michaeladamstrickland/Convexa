/**
 * test-normalize-score.cjs
 * Simple test for address normalization and lead scoring
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Define simple versions of the functions to test
function normalizeAddress(input) {
  if (!input) return { normalized: '', hash: '', parts: {} };

  // Remove common punctuation and extra whitespace
  let normalized = input
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
  
  // Simple normalization of common terms
  normalized = normalized
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bBOULEVARD\b/g, 'BLVD');

  // Simple parsing (basic implementation - placeholder for libpostal)
  const parts = {};
  const segments = normalized.split(' ');
  
  // Extract city, state, zip from the end if possible
  if (segments.length >= 4) {
    // Look for zip at the end
    const zipMatch = segments[segments.length - 1].match(/^\d{5}$/);
    if (zipMatch) {
      parts.zip = zipMatch[0];
      // Look for state before zip
      if (segments.length >= 5 && segments[segments.length - 2].length === 2) {
        parts.state = segments[segments.length - 2];
        
        // Try to find city
        let cityEndPos = segments.length - 3;
        let cityStartPos = cityEndPos;
        
        // Look for comma to find city start
        while (cityStartPos > 0) {
          if (segments[cityStartPos].includes(',')) {
            break;
          }
          cityStartPos--;
        }
        
        if (cityStartPos < cityEndPos) {
          parts.city = segments.slice(cityStartPos + 1, cityEndPos + 1).join(' ');
          parts.line1 = segments.slice(0, cityStartPos + 1).join(' ').replace(',', '');
        } else {
          parts.line1 = segments.slice(0, cityEndPos).join(' ');
        }
      } else {
        parts.line1 = segments.slice(0, segments.length - 1).join(' ');
      }
    } else {
      parts.line1 = normalized;
    }
  } else {
    parts.line1 = normalized;
  }
  
  // Hash the normalized address for deduplication
  const hash = crypto.createHash('sha256')
    .update(normalized)
    .digest('hex');
  
  return { 
    normalized, 
    hash, 
    parts
  };
}

function normalizeOwnerName(name) {
  if (!name) return '';
  
  // Convert to uppercase
  let normalized = name.toUpperCase();
  
  // Remove common suffixes for individuals
  normalized = normalized
    .replace(/\s+(?:JR|SR|I{1,3}|IV|V)\.?$/g, '')
    .replace(/\s+(?:ESQ|ESQUIRE)\.?$/g, '');
  
  // Handle "ET AL" variations
  normalized = normalized
    .replace(/\s+(?:ET\s+AL|ET\s+UX)\.?$/g, '')
    .replace(/\s+AND\s+OTHERS$/g, '');
  
  // Handle trust wording
  normalized = normalized
    .replace(/\s+(?:TRUST|TRUSTEE|LIVING TRUST|FAMILY TRUST)$/g, '')
    .replace(/\s+(?:REVOCABLE|IRREVOCABLE)$/g, '');
  
  // Handle LLC/Corp/Inc variations
  normalized = normalized
    .replace(/\s+(?:LLC|LC|LLP|LP|INC|INCORPORATED|CORPORATION|CORP)\.?$/g, '')
    .replace(/\s+(?:LIMITED|COMPANY|PARTNERS|PARTNERSHIP)$/g, '');
  
  // Normalize whitespace and punctuation
  normalized = normalized
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
  
  return normalized;
}

function scoreLead(lead) {
  if (!lead) return 0;
  
  let score = 0;

  // Distress signals (big weight)
  const signals = new Set(lead.distressSignals || []);
  if (signals.has("PROBATE")) score += 25;
  if (signals.has("CODE_VIOLATION")) score += 15;
  if (signals.has("TAX_DELINQUENT")) score += 15;
  if (signals.has("PRE_FORECLOSURE")) score += 20;
  if (signals.has("AUCTION")) score += 18;
  if (signals.has("FSBO")) score += 10;
  if (signals.has("EVICTION")) score += 12;

  // Equity heuristic
  if (lead.avm && lead.lastSale?.amount) {
    const equity = lead.avm - lead.lastSale.amount;
    const equityPercent = equity / Math.max(lead.avm, 1);
    
    if (equityPercent > 0.5) score += 20;
    else if (equityPercent > 0.3) score += 12;
    else if (equityPercent > 0.15) score += 6;
  }

  // Owner-occupied vs absentee
  const ownerMailingZip = lead.ownerMailingZip || 
    (lead.ownerInfo && lead.ownerInfo.mailingAddress && lead.ownerInfo.mailingAddress.zip);
  
  if (ownerMailingZip && lead.address && lead.address.zip && 
      ownerMailingZip !== lead.address.zip) {
    score += 10; // absentee owner
  }

  // Freshness
  if (lead.lastEventDate) {
    const days = (Date.now() - new Date(lead.lastEventDate).getTime()) / 86400000;
    if (days <= 7) score += 10;
    else if (days <= 30) score += 6;
  }

  // Cap at 100
  return Math.min(100, Math.round(score));
}

function temperature(score) {
  if (score >= 80) return "On Fire";
  if (score >= 60) return "Hot";
  if (score >= 35) return "Warm";
  return "Dead";
}

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
  console.log(`Hash: ${normalized.hash.substring(0, 8)}...`);
  console.log(`Parts: ${JSON.stringify(normalized.parts)}`);
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

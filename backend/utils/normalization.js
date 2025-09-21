// Normalization helpers for address/person and signature builders
// Implements primary and secondary (sanitized) signatures

import crypto from 'crypto';

const ABBREV = new Map([
  ['ST', 'STREET'],
  ['AVE', 'AVENUE'],
  ['BLVD', 'BOULEVARD'],
  ['RD', 'ROAD'],
  ['DR', 'DRIVE'],
  ['LN', 'LANE'],
  ['CT', 'COURT'],
  ['PL', 'PLACE'],
  ['TER', 'TERRACE'],
  ['HWY', 'HIGHWAY'],
]);

const UNIT_MARKERS_RE = /\b(?:APT|UNIT|STE|SUITE|FL|FLOOR|#)\b\s*\S*/gi;

export function normalizeStreet(streetRaw = '') {
  let s = String(streetRaw || '').toUpperCase();
  // Remove punctuation except # which we handle separately
  s = s.replace(/[.,]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // Expand common abbreviations when they appear as tokens at end
  const parts = s.split(' ').filter(Boolean);
  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    const exp = ABBREV.get(last);
    if (exp) {
      parts[parts.length - 1] = exp;
    }
  }
  return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

export function normalizeCityStateZip(city = '', state = '', zip = '') {
  const c = String(city || '').toUpperCase().trim();
  const st = String(state || '').toUpperCase().trim();
  let z = String(zip || '').trim();
  const m = z.match(/^(\d{5})(?:-\d{4})?$/);
  z = m ? m[1] : (z || '');
  return { city: c, state: st, zip: z };
}

export function normalizePerson(first = '', last = '') {
  const f = String(first || '').toUpperCase().trim();
  const l = String(last || '').toUpperCase().trim();
  return `${f}|${l}`;
}

export function hasUnitMarkers(streetRaw = '') {
  return UNIT_MARKERS_RE.test(String(streetRaw || '').toUpperCase());
}

export function buildSignatures({ street, city, state, zip, first, last }) {
  const streetNorm = normalizeStreet(street);
  const { city: c, state: s, zip: z } = normalizeCityStateZip(city, state, zip);
  const person = normalizePerson(first, last);
  const addr = `${streetNorm}|${c}|${s}|${z}`;
  const primary = sha256(`${addr}#${person}`);
  const sanitizedStreet = streetNorm.replace(UNIT_MARKERS_RE, '').replace(/\s{2,}/g, ' ').trim();
  const addrSan = `${sanitizedStreet}|${c}|${s}|${z}`;
  const secondary = sha256(`${addrSan}#${person}`);
  return {
    primary,
    secondary,
    normalized_address: addr,
    normalized_person: person,
    hasUnit: sanitizedStreet !== streetNorm,
  };
}

export function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

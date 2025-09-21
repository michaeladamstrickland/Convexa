import crypto from 'crypto';

// Simple HMAC-based signer for artifact paths
// Inputs: relative path (string), expiration epoch seconds (number), secret (string)
// Output: hex HMAC string
export function signPath(pathRel, expEpochSec, secret) {
  const msg = `${String(pathRel)}|${Number(expEpochSec)}`;
  return crypto.createHmac('sha256', String(secret)).update(msg).digest('hex');
}

// Verify a signed path: returns boolean
export function verifyPath(pathRel, expEpochSec, sig, secret) {
  const now = Math.floor(Date.now() / 1000);
  if (!expEpochSec || Number(expEpochSec) < now) return false;
  const expected = signPath(pathRel, expEpochSec, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig)));
  } catch {
    return false;
  }
}

import crypto from 'crypto';

export type SignedPayload = { path: string; exp: number; sig: string };

export function signPath(pathRel: string, expEpochSec: number, secret: string): string {
  const h = crypto.createHmac('sha256', secret).update(`${pathRel}|${expEpochSec}`).digest('hex');
  return h;
}

export function verifyPath(pathRel: string, expEpochSec: number, sig: string, secret: string): boolean {
  if (!expEpochSec || expEpochSec < Math.floor(Date.now() / 1000)) return false;
  const expected = signPath(pathRel, expEpochSec, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

import crypto from 'crypto';

/**
 * verifyWebhookSignature
 * Usage:
 *   const valid = verifyWebhookSignature({
 *     body: rawBodyString,
 *     signature: req.headers['x-signature'] as string,
 *     secret: subscription.signingSecret
 *   });
 * Header format expected: X-Signature: sha256=<hexDigest>
 */
export function verifyWebhookSignature({ body, signature, secret }: { body: string; signature: string; secret: string; }): boolean {
  if (!signature || !signature.startsWith('sha256=')) return false;
  const given = signature.slice('sha256='.length);
  const computed = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(computed, 'utf8'));
  } catch {
    return false;
  }
}

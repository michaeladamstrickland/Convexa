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
export declare function verifyWebhookSignature({ body, signature, secret }: {
    body: string;
    signature: string;
    secret: string;
}): boolean;
//# sourceMappingURL=verifyWebhookSignature.d.ts.map
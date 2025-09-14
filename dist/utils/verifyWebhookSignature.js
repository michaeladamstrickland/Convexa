"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = verifyWebhookSignature;
const crypto_1 = __importDefault(require("crypto"));
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
function verifyWebhookSignature({ body, signature, secret }) {
    if (!signature || !signature.startsWith('sha256='))
        return false;
    const given = signature.slice('sha256='.length);
    const computed = crypto_1.default.createHmac('sha256', secret).update(body).digest('hex');
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(computed, 'utf8'));
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=verifyWebhookSignature.js.map
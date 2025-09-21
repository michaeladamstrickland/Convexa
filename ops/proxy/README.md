# Proxy Configuration and Signed URL Environment Variables

This directory contains documentation related to proxy configurations (e.g., Nginx samples) and environment variables used for signed URLs.

## Signed URL Environment Variables

The application uses signed URLs for secure access to certain resources. These URLs are generated and verified using a shared secret.

### `SIGNED_URL_SECRET`

*   **Description**: A cryptographic secret key used to sign and verify URLs. This secret ensures that URLs are tamper-proof and have not expired.
*   **Purpose**: Prevents unauthorized access to sensitive resources by ensuring that only URLs signed with the correct secret are considered valid.
*   **Format**: A long, random string of characters. It should be kept confidential and not exposed publicly.
*   **Example Value**: `YOUR_SUPER_SECRET_KEY_FOR_SIGNED_URLS_1234567890`
*   **Usage**: This variable is used by the `signPath` and `verifyPath` functions in `src/lib/signedUrl.ts`. It should be set in your environment (e.g., `.env` file, Kubernetes secrets, etc.) for both the server generating the URLs and any service verifying them (e.g., a proxy or another backend service).

**Example of how it's used in code (conceptual):**

```typescript
// Generation
const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
const signature = signPath('/path/to/resource', expiration, process.env.SIGNED_URL_SECRET);
const signedUrl = `/path/to/resource?exp=${expiration}&sig=${signature}`;

// Verification
const isValid = verifyPath(path, expiration, signature, process.env.SIGNED_URL_SECRET);
```

**Security Considerations:**
*   **Confidentiality**: Never commit `SIGNED_URL_SECRET` directly into your codebase or expose it in client-side applications.
*   **Rotation**: Consider rotating this secret periodically as part of your security policy.
*   **Uniqueness**: Use a unique secret for each environment (development, staging, production).

// Placeholder S3 storage; wire AWS SDK and bucket configs when infra is ready.
import { signPath } from '../signedUrl';

export function createS3Storage() {
  return {
    async putObject(key: string, _data: Buffer | NodeJS.ReadableStream, _contentType?: string) {
      throw new Error('S3 storage not yet implemented');
    },
    async getObject(_key: string): Promise<Buffer> {
      throw new Error('S3 storage not yet implemented');
    },
    async signUrl(key: string, ttlSeconds: number): Promise<string> {
      // Temporary local signature to avoid breaking callers; replace with real S3 signed URL later.
      const secret = process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret';
      const exp = Math.floor(Date.now() / 1000) + (ttlSeconds || 86400);
      const sig = signPath(key, exp, secret);
      return `/admin/artifact-download?path=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
    }
  };
}

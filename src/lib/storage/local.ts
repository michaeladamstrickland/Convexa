import fs from 'fs';
import path from 'path';
import { signPath } from '../signedUrl';

export function createLocalStorage() {
  const root = process.env.LOCAL_STORAGE_PATH || path.resolve(process.cwd(), 'backend', 'run_storage');
  fs.mkdirSync(root, { recursive: true });
  return {
    async putObject(key: string, data: Buffer | NodeJS.ReadableStream, _contentType?: string) {
      const abs = path.resolve(root, key);
      const dir = path.dirname(abs);
      fs.mkdirSync(dir, { recursive: true });
      if (Buffer.isBuffer(data)) {
        await fs.promises.writeFile(abs, data);
      } else {
        const ws = fs.createWriteStream(abs);
        await new Promise<void>((resolve, reject) => {
          data.pipe(ws).on('finish', () => resolve()).on('error', reject);
        });
      }
    },
    async getObject(key: string): Promise<Buffer> {
      const abs = path.resolve(root, key);
      return await fs.promises.readFile(abs);
    },
    async signUrl(key: string, ttlSeconds: number): Promise<string> {
      const secret = process.env.ARTIFACT_SIGNING_SECRET || 'dev-secret';
      const exp = Math.floor(Date.now() / 1000) + (ttlSeconds || 86400);
      const sig = signPath(key, exp, secret);
      return `/admin/artifact-download?path=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
    }
  };
}

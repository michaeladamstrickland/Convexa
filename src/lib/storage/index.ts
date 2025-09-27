export interface Storage {
  putObject(key: string, data: Buffer | NodeJS.ReadableStream, contentType?: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  signUrl(key: string, ttlSeconds: number): Promise<string>;
}

export async function createStorage(): Promise<Storage> {
  const backend = (process.env.STORAGE_BACKEND || 'local').toLowerCase();
  if (backend === 's3') {
    const mod = await import('./s3.js').catch(() => import('./s3'));
    return mod.createS3Storage();
  }
  const mod = await import('./local.js').catch(() => import('./local'));
  return mod.createLocalStorage();
}

import { Router, Request, Response } from 'express';
import os from 'os';
import { performance } from 'perf_hooks';

// Lazy optional imports (so absence of deps doesn't crash /healthz)
let prismaAvailable = false;
let redisAvailable = false;
let prisma: any = null;
let redisClient: any = null;

try {
  // Attempt to require Prisma client if project uses it
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  prisma = require('../../prismaClient')?.prisma || null;
  if (prisma) prismaAvailable = true;
} catch {}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const redisMod = require('redis');
  if (redisMod?.createClient) {
    redisClient = redisMod.createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', () => {});
    redisAvailable = true;
  }
} catch {}

const router = Router();
const startedAt = Date.now();

function buildBase() {
  return {
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    build: process.env.BUILD_SHA || 'dev',
    hostname: os.hostname(),
    pid: process.pid
  };
}

router.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json(buildBase());
});

router.get('/readyz', async (_req: Request, res: Response) => {
  const base = buildBase();
  const dependencyErrors: string[] = [];
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // DB check
  if (prismaAvailable && prisma) {
    const t0 = performance.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = { ok: true, latencyMs: +(performance.now() - t0).toFixed(2) };
    } catch (e: any) {
      checks.postgres = { ok: false, error: e?.message };
      dependencyErrors.push('db unreachable');
    }
  } else {
    checks.postgres = { ok: false, error: 'prisma not initialized' };
    dependencyErrors.push('db missing');
  }

  // Redis check (best effort, only if configured)
  if (redisAvailable && process.env.REDIS_URL) {
    const t0 = performance.now();
    try {
      if (!redisClient.isOpen) await redisClient.connect();
      await redisClient.ping();
      checks.redis = { ok: true, latencyMs: +(performance.now() - t0).toFixed(2) };
    } catch (e: any) {
      checks.redis = { ok: false, error: e?.message };
      dependencyErrors.push('redis unreachable');
    }
  } else if (process.env.REDIS_URL) {
    checks.redis = { ok: false, error: 'redis client not available' };
    dependencyErrors.push('redis missing');
  } else {
    checks.redis = { ok: true, latencyMs: 0 }; // not required yet
  }

  if (dependencyErrors.length) {
    return res.status(503).json({
      ...base,
      status: 'not_ready',
      errors: dependencyErrors,
      checks
    });
  }

  res.status(200).json({ ...base, checks });
});

export default router;

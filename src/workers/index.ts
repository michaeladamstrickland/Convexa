// Central registry for BullMQ workers
import type { Worker } from 'bullmq';

const workers: Worker[] = [];

export function registerWorker(w: Worker) {
  if (!workers.includes(w)) workers.push(w);
}

export async function shutdownAllWorkers() {
  for (const w of workers) {
    try { await (w as any).close?.(); } catch {}
    // BullMQ Worker may hold multiple ioredis clients; close them all defensively
    try { await (w as any).connection?.disconnect?.(); } catch {}
    try { await (w as any).client?.disconnect?.(); } catch {}
    try { await (w as any).bclient?.disconnect?.(); } catch {}
    try { await (w as any).subscriber?.disconnect?.(); } catch {}
    // Catch any additional redis-like handles hanging off the worker
    try {
      for (const key of Object.keys(w as any)) {
        const v: any = (w as any)[key];
        if (v && typeof v.disconnect === 'function' && (v.constructor?.name || '').toLowerCase().includes('redis')) {
          try { await v.disconnect(); } catch {}
        }
      }
    } catch {}
  }
  workers.length = 0;
}

export const __WORKER_REGISTRY_MODULE__ = true;

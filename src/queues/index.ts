// Central registry for BullMQ queues
import type { Queue } from 'bullmq';

const queues: Queue[] = [];

export function registerQueue(q: Queue) {
  if (!queues.includes(q)) queues.push(q);
}

export async function shutdownAllQueues() {
  for (const q of queues) {
    try { await (q as any).drain?.(); } catch {}
    try { await (q as any).close?.(); } catch {}
    // Disconnect any ioredis clients attached to the queue
    try { await (q as any).client?.disconnect?.(); } catch {}
    try { await (q as any).bclient?.disconnect?.(); } catch {}
    try { await (q as any).subscriber?.disconnect?.(); } catch {}
    try { await (q as any).events?.connection?.disconnect?.(); } catch {}
    try { await (q as any).events?.client?.disconnect?.(); } catch {}
    try { await (q as any).events?.bclient?.disconnect?.(); } catch {}
    try { await (q as any).events?.subscriber?.disconnect?.(); } catch {}
    // Fallback: iterate enumerable props and disconnect redis-like objects
    try {
      for (const key of Object.keys(q as any)) {
        const v: any = (q as any)[key];
        if (v && typeof v.disconnect === 'function' && (v.constructor?.name || '').toLowerCase().includes('redis')) {
          try { await v.disconnect(); } catch {}
        }
      }
    } catch {}
  }
  queues.length = 0;
}

// Export a runtime constant to guarantee this file is treated as a module in all TS configs
export const __QUEUE_REGISTRY_MODULE__ = true;

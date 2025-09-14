import { shutdownAllWorkers } from '../src/workers';
import { shutdownAllQueues } from '../src/queues';
import { disconnectPrisma } from '../src/db/prisma';
import http from 'http';
import https from 'https';

export default async function globalTeardown() {
  await shutdownAllWorkers();
  await shutdownAllQueues();
  const server = (global as any).__TEST_SERVER__;
  if (server) {
    await new Promise(r => server.close(r));
  }
  await disconnectPrisma();
  // Aggressively close any lingering HTTP/HTTPS agent sockets (e.g., from node-fetch)
  try { (http as any).globalAgent?.destroy?.(); } catch {}
  try { (https as any).globalAgent?.destroy?.(); } catch {}
  // Optional diagnostics: log any active handles/requests that might keep Jest alive
  try {
    const handles: any[] = (process as any)._getActiveHandles?.() || [];
    const requests: any[] = (process as any)._getActiveRequests?.() || [];
    const detail = handles.map((h: any) => {
      const name = h?.constructor?.name || typeof h;
      if (name === 'Socket' && h) {
        return {
          type: name,
          localAddress: h.localAddress,
          localPort: h.localPort,
          remoteAddress: h.remoteAddress,
          remotePort: h.remotePort,
          readable: h.readable,
          writable: h.writable
        };
      }
      if (name === 'WriteStream' && h) {
        return { type: name, fd: (h.fd ?? undefined) };
      }
      return { type: name };
    });
    console.log(JSON.stringify({ level:'warn', component:'jest', evt:'postTeardownActive', handles: detail, requestsCount: requests.length, ts: new Date().toISOString() }));
  } catch {}
}

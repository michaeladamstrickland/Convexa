"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__WORKER_REGISTRY_MODULE__ = void 0;
exports.registerWorker = registerWorker;
exports.shutdownAllWorkers = shutdownAllWorkers;
const workers = [];
function registerWorker(w) {
    if (!workers.includes(w))
        workers.push(w);
}
async function shutdownAllWorkers() {
    for (const w of workers) {
        try {
            await w.close?.();
        }
        catch { }
        // BullMQ Worker may hold multiple ioredis clients; close them all defensively
        try {
            await w.connection?.disconnect?.();
        }
        catch { }
        try {
            await w.client?.disconnect?.();
        }
        catch { }
        try {
            await w.bclient?.disconnect?.();
        }
        catch { }
        try {
            await w.subscriber?.disconnect?.();
        }
        catch { }
        // Catch any additional redis-like handles hanging off the worker
        try {
            for (const key of Object.keys(w)) {
                const v = w[key];
                if (v && typeof v.disconnect === 'function' && (v.constructor?.name || '').toLowerCase().includes('redis')) {
                    try {
                        await v.disconnect();
                    }
                    catch { }
                }
            }
        }
        catch { }
    }
    workers.length = 0;
}
exports.__WORKER_REGISTRY_MODULE__ = true;
//# sourceMappingURL=index.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__QUEUE_REGISTRY_MODULE__ = void 0;
exports.registerQueue = registerQueue;
exports.shutdownAllQueues = shutdownAllQueues;
const queues = [];
function registerQueue(q) {
    if (!queues.includes(q))
        queues.push(q);
}
async function shutdownAllQueues() {
    for (const q of queues) {
        try {
            await q.drain?.();
        }
        catch { }
        try {
            await q.close?.();
        }
        catch { }
        // Disconnect any ioredis clients attached to the queue
        try {
            await q.client?.disconnect?.();
        }
        catch { }
        try {
            await q.bclient?.disconnect?.();
        }
        catch { }
        try {
            await q.subscriber?.disconnect?.();
        }
        catch { }
        try {
            await q.events?.connection?.disconnect?.();
        }
        catch { }
        try {
            await q.events?.client?.disconnect?.();
        }
        catch { }
        try {
            await q.events?.bclient?.disconnect?.();
        }
        catch { }
        try {
            await q.events?.subscriber?.disconnect?.();
        }
        catch { }
        // Fallback: iterate enumerable props and disconnect redis-like objects
        try {
            for (const key of Object.keys(q)) {
                const v = q[key];
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
    queues.length = 0;
}
// Export a runtime constant to guarantee this file is treated as a module in all TS configs
exports.__QUEUE_REGISTRY_MODULE__ = true;
//# sourceMappingURL=index.js.map
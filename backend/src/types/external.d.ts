// Module declarations for untyped external/local modules

declare module '../zip-search-routes-new';

declare module 'redis' {
  import { EventEmitter } from 'events';
  interface RedisClient extends EventEmitter {
    isOpen: boolean;
    connect(): Promise<void>;
    ping(): Promise<string>;
    quit(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  export function createClient(options: { url?: string }): RedisClient;
}

// Minimal bullmq type shim (project can replace with real types after migration to Postgres finalized)
declare module 'bullmq' {
  export interface QueueOptions { connection?: { url?: string } }
  export class Queue<T=any> {
    constructor(name: string, opts?: QueueOptions);
    add(name: string, data: T, opts?: any): Promise<{ id: string; name: string; id?: string }>;
  }
  export interface Job<T=any> { id: string | number; name: string; data: T }
  export class Worker<T=any> {
    constructor(name: string, processor: (job: Job<T>) => Promise<any>, opts?: QueueOptions);
    on(event: string, handler: (...args: any[]) => void): void;
  }
}

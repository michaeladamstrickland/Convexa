declare module 'bullmq' {
  export class Queue<T = any> {
    constructor(name: string, opts?: any);
    add(name: string, data: T, opts?: any): Promise<{ id: string; name: string }>;
  }
  export interface Job<T = any> { id: string | number; name: string; data: T; }
  export class Worker<T = any> {
    constructor(name: string, processor: (job: Job<T>) => Promise<any>, opts?: any);
    on(event: 'completed' | 'failed', handler: (...args: any[]) => void): void;
  }
}

import { Worker } from 'bullmq';
export declare const webhookMetrics: {
    delivered: number;
    failed: number;
    durations: number[];
};
export declare const webhookWorker: Worker<any, any, string>;
export declare function shutdownWebhookWorker(): Promise<void>;
//# sourceMappingURL=webhookWorker.d.ts.map
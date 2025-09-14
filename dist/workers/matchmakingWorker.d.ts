import { Worker } from 'bullmq';
export declare const matchmakingMetrics: {
    durations: number[];
    statusCounts: Map<string, number>;
    webhookDeliveredTotal: number;
};
export declare const matchmakingWorker: Worker<any, any, string>;
export declare function shutdownMatchmakingWorker(): Promise<void>;
//# sourceMappingURL=matchmakingWorker.d.ts.map
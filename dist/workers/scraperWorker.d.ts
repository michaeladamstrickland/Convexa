import { Worker } from 'bullmq';
import { DispatcherResult } from '../adapters/scrapers';
export declare const metrics: {
    processed: number;
    success: number;
    failed: number;
    perSource: Map<string, {
        success: number;
        failed: number;
    }>;
    durations: number[];
};
export declare const workerState: {
    active: boolean;
    activeJobs: number;
    lastJobCompletedAt: Date | null;
};
export declare const scraperWorker: Worker<any, DispatcherResult | undefined, string>;
export declare function shutdownScraperWorker(): Promise<void>;
//# sourceMappingURL=scraperWorker.d.ts.map
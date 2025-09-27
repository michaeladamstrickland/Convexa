import { Queue } from 'bullmq';
export declare const SCRAPER_QUEUE_NAME = "scraper-jobs";
export interface EnqueueResult {
    id: string;
    name: string;
}
export declare function getScraperQueue(): Queue<any, any, string, any, any, string>;
export declare const scraperQueue: Queue<any, any, string, any, any, string>;
export declare function shutdownScraperQueue(): Promise<void>;
export declare function enqueueScraperJob(raw: unknown, opts?: {
    jobId?: string;
    attempts?: number;
    backoff?: {
        type: string;
        delay: number;
    };
}): Promise<{
    id: string | undefined;
    name: string;
}>;
//# sourceMappingURL=scraperQueue.d.ts.map
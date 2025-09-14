export declare function triggerDailyScheduler(force?: boolean): Promise<{
    date: string;
    enqueued: {
        source: string;
        jobId?: string;
        skipped: boolean;
        reason?: string;
    }[];
}>;
export declare function startDailyScheduler(): void;
//# sourceMappingURL=dailyScheduler.d.ts.map
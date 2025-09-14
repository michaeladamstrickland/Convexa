import { Queue } from 'bullmq';
export declare const MATCHMAKING_QUEUE_NAME = "matchmaking";
export interface MatchmakingJobQueuePayload {
    matchmakingJobId: string;
}
export declare function getMatchmakingQueue(): Queue<any, any, string, any, any, string>;
export declare function enqueueMatchmakingJob(matchmakingJobId: string): Promise<import("bullmq").Job<any, any, string>>;
export declare function shutdownMatchmakingQueue(): Promise<void>;
//# sourceMappingURL=matchmakingQueue.d.ts.map
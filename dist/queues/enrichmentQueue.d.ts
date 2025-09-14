import { Queue } from 'bullmq';
export declare const ENRICHMENT_QUEUE_NAME = "enrichment";
export interface EnrichmentJobPayload {
    propertyId: string;
}
export declare function getEnrichmentQueue(): Queue<any, any, string, any, any, string>;
export declare function enqueueEnrichmentJob(payload: EnrichmentJobPayload): Promise<import("bullmq").Job<any, any, string>>;
export declare function shutdownEnrichmentQueue(): Promise<void>;
//# sourceMappingURL=enrichmentQueue.d.ts.map
import { Queue } from 'bullmq';
export declare const WEBHOOK_QUEUE_NAME = "webhook-deliveries";
export interface WebhookJobPayload {
    subscriptionId: string;
    eventType: string;
    payload: any;
    failureId?: string;
    replayMode?: 'single' | 'bulk';
}
export declare function getWebhookQueue(): Queue<any, any, string, any, any, string>;
export declare function shutdownWebhookQueue(): Promise<void>;
export declare function enqueueWebhookDelivery(payload: WebhookJobPayload): Promise<import("bullmq").Job<any, any, string>>;
//# sourceMappingURL=webhookQueue.d.ts.map
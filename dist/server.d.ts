import client from 'prom-client';
export declare const httpRequestErrorsTotal: client.Counter<"method" | "status" | "path">;
export declare const convexaCacheHitTotal: client.Counter<"operation" | "cache_name">;
export declare const convexaCacheTotal: client.Counter<"operation" | "cache_name">;
export declare const convexaQuotaFraction: client.Gauge<"resource">;
export declare const queueDepth: client.Gauge<"queue_name">;
export declare const dlqDepth: client.Gauge<"queue_name">;
export declare const convexaWeeklyExportsTotal: client.Counter<string>;
export declare const convexaImportRowsTotal: client.Counter<"result">;
declare class LeadFlowAIServer {
    private app;
    private obituaryMiner;
    private revenueMetrics;
    private isRunning;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    private startIntelligenceEngine;
    private initializeRevenueMetrics;
    private generateMockLeads;
    start(port?: number): void;
}
export default LeadFlowAIServer;
declare const __leadflowServerInstance: LeadFlowAIServer;
export { __leadflowServerInstance };
//# sourceMappingURL=server.d.ts.map
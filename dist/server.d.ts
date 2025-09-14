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
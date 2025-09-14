declare class LeadFlowAIRealServer {
    private app;
    private realDataService;
    private databaseService;
    private isRunning;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    start(port?: number): void;
}
declare const server: LeadFlowAIRealServer;
export default server;
//# sourceMappingURL=realServer.d.ts.map
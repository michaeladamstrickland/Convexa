/**
 * LEADFLOW AI EMPIRE LAUNCHER
 *
 * The Ultimate Intelligence-Driven Real Estate Empire Builder
 *
 * PHASE 2: AI-POWERED DEAL EXECUTION ENGINE
 * Target: 50,000+ qualified leads per month
 * Goal: $500K-$2M monthly revenue within 120 days
 *
 * FEATURES IMPLEMENTED:
 * ✅ Death Intelligence Mining System
 * ✅ Probate Court Tracking Network
 * ✅ Code Violation Intelligence Extractor
 * ✅ Vacancy Detection with AI Vision
 * ✅ Tax Delinquency Intelligence Tracker
 * ✅ Neural Network Motivation Predictor
 * ✅ Automated Lead Scoring & Qualification
 * ✅ Intelligent Campaign Automation
 * ✅ Multi-Channel Deal Execution Engine
 * ✅ Empire Orchestration System
 */
interface LaunchConfig {
    mode: 'development' | 'production' | 'testing';
    daily_lead_target: number;
    monthly_revenue_goal: number;
    automation_level: 'basic' | 'advanced' | 'ultra';
    intelligence_depth: 'standard' | 'deep' | 'ultra';
}
declare class LeadFlowAILauncher {
    private empire;
    private config;
    constructor(config?: Partial<LaunchConfig>);
    launchEmpire(): Promise<void>;
    runContinuousOperations(): Promise<void>;
    generatePerformanceReport(): Promise<any>;
    private validateEnvironment;
    pauseOperations(): Promise<void>;
    resumeOperations(): Promise<void>;
    exportData(): Promise<void>;
}
export { LeadFlowAILauncher, LaunchConfig };
//# sourceMappingURL=index.d.ts.map
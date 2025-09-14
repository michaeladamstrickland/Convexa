import { ProbateCase } from '../types/index';
export declare class ProbateCourtTracker {
    private openai;
    private courtSystems;
    constructor();
    trackProbateFilings(counties: string[]): Promise<ProbateCase[]>;
    private scrapeProbateDocket;
    private scrapeOdysseyPortal;
    private enrichProbateCases;
    private findDeceasedProperties;
    private identifyHeirsFromCourt;
    private generateProbateDealBrief;
    private calculateProbateUrgency;
    private calculateDealPotential;
    private calculateHeirMotivation;
    private identifyCourtSystem;
    private initializeCourtSystems;
    private skipTraceHeirs;
    private extractAttorneyInfo;
    private isProbateCase;
    private parseOdysseyCaseData;
    private extractCaseNumber;
    private extractDeceasedName;
    private extractFilingDate;
    private extractCaseStatus;
    private extractCaseType;
    private prioritizeProbateCases;
    private determineApproachStrategy;
    private delay;
    private scrapeTylerTech;
    private scrapeJusticeSystems;
    private scrapeGenericPortal;
}
//# sourceMappingURL=probateCourtTracker.d.ts.map
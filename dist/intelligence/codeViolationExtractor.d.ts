import { PropertyViolation } from '../types/index';
export declare class CodeViolationExtractor {
    private openai;
    private municipalSources;
    constructor();
    extractViolationIntelligence(markets: string[]): Promise<PropertyViolation[]>;
    private scrapeMunicipalPortals;
    private scrapeSpecificPortal;
    private scrapeHTMLViolations;
    private parseViolationRow;
    private enrichViolationIntelligence;
    private classifyViolation;
    private calculateSeverityScore;
    private estimateComplianceCost;
    private inferPropertyCondition;
    private assessOwnerStress;
    private calculateDealPotential;
    private checkRepeatOffender;
    private extractComplianceDeadline;
    private determineEnforcementStage;
    private extractDistressIndicators;
    private consolidateViolations;
    private isValidViolation;
    private calculateDaysSinceViolation;
    private getPenaltyMultiplier;
    private estimatePermitFees;
    private getEnforcementStress;
    private initializeMunicipalSources;
    private extractFromPDFDockets;
    private processCSVFeeds;
    private submitFOIARequests;
    private downloadCSVViolations;
    private fetchJSONViolations;
    private scrapeGenericPortal;
    private delay;
}
//# sourceMappingURL=codeViolationExtractor.d.ts.map
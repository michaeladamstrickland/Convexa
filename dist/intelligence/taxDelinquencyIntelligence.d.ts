import { TaxIntelligence } from '../types/index';
export declare class TaxDelinquencyIntelligence {
    private openai;
    private taxPortals;
    constructor();
    gatherTaxIntelligence(counties: string[]): Promise<TaxIntelligence[]>;
    private scrapeTreasurerPortals;
    private scrapeTaxPortal;
    private scrapeHTMLTaxRecords;
    private parseTaxRow;
    private enrichTaxIntelligence;
    private calculateForeclosureTimeline;
    private assessEquityPosition;
    private calculateDesperationScore;
    private calculateDealUrgency;
    private recommendStrategy;
    private generatePaymentHistory;
    private calculateContactUrgency;
    private calculateForeclosureRisk;
    private calculateYearsDelinquent;
    private estimatePropertyValue;
    private getRedemptionPeriod;
    private parseAmount;
    private extractTaxYear;
    private findTaxPortal;
    private consolidateTaxData;
    private isValidTaxRecord;
    private initializeTaxPortals;
    private accessTaxAssessorAPIs;
    private monitorTaxSaleSchedules;
    private trackRedemptionPeriods;
    private fetchJSONTaxData;
    private downloadCSVTaxData;
    private scrapeGenericTaxPortal;
    private delay;
}
//# sourceMappingURL=taxDelinquencyIntelligence.d.ts.map
export declare class RealDataService {
    private db;
    private apiKeys;
    constructor();
    /**
     * Scrape Maricopa County Probate Records
     * This is real public data available for free
     */
    scrapeProbateRecords(county?: string): Promise<any[]>;
    /**
     * Scrape City Code Violations
     * Phoenix, Scottsdale, Tempe public violation databases
     */
    scrapeCodeViolations(city?: string): Promise<any[]>;
    /**
     * Scrape Tax Delinquency Records
     * County assessor public databases
     */
    scrapeTaxDelinquencies(county?: string): Promise<any[]>;
    /**
     * Enhance leads with contact information using skip trace services
     */
    enhanceWithContactInfo(leads: any[]): Promise<any[]>;
    /**
     * Run complete daily lead generation pipeline
     */
    runDailyPipeline(): Promise<any>;
    private findLeadByAddress;
    private calculateProbateMotivation;
    private calculateViolationMotivation;
    private calculateTaxMotivation;
    private simulateProbateFilings;
    private simulateCodeViolations;
    private simulateTaxDelinquencies;
    private simulateSkipTrace;
}
//# sourceMappingURL=realDataService.d.ts.map
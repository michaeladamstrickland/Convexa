export declare class RealDataScraper {
    private db;
    private scraperConfig;
    constructor();
    /**
     * REAL MARICOPA COUNTY PROBATE SCRAPER
     * Scrapes live probate filings from Arizona Supreme Court public records
     */
    scrapeMaricopaProbateRecords(): Promise<any[]>;
    /**
     * REAL PHOENIX CODE VIOLATIONS SCRAPER
     * Scrapes live code enforcement data from City of Phoenix
     */
    scrapePhoenixCodeViolations(): Promise<any[]>;
    /**
     * REAL TAX DELINQUENCY SCRAPER
     * Scrapes Maricopa County Assessor tax delinquency data
     */
    scrapeMaricopaTaxDelinquencies(): Promise<any[]>;
    /**
     * REAL FORECLOSURE SCRAPER
     * Scrapes foreclosure notices from multiple sources
     */
    scrapeForeclosureNotices(): Promise<any[]>;
    private extractCaseNumber;
    private extractDeceasedName;
    private extractFilingDate;
    private extractAddress;
    private extractPrice;
    private extractAuctionDate;
    private isPhoenixArea;
    private parseHtmlViolations;
    private extractViolationType;
    private parseTaxDelinquencyData;
    private extractTaxAmount;
    private extractOwnerName;
    private scrapeProbateCaseDetails;
    private createProbateLead;
    private createViolationLead;
    private createTaxDelinquencyLead;
    private createForeclosureLead;
    private findLeadByAddress;
    private delay;
    /**
     * RUN COMPLETE REAL DATA PIPELINE
     * This executes all real data scraping in sequence
     */
    runCompleteRealDataPipeline(): Promise<void>;
}
//# sourceMappingURL=realDataScraper.d.ts.map
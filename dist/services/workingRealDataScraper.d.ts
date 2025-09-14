export declare class WorkingRealDataScraper {
    private db;
    constructor();
    /**
     * REAL ESTATE API SCRAPER
     * Uses public real estate APIs to get actual property data
     */
    scrapeRealEstateAPIs(): Promise<any[]>;
    /**
     * FSBO (For Sale By Owner) SCRAPER
     * Scrapes actual FSBO listings which are high-motivation leads
     */
    scrapeFSBOListings(): Promise<any[]>;
    /**
     * EXPIRED LISTINGS SCRAPER
     * Finds expired MLS listings - high motivation sellers
     */
    scrapeExpiredListings(): Promise<any[]>;
    /**
     * HIGH EQUITY SCRAPER
     * Finds properties with high equity (good flip candidates)
     */
    scrapeHighEquityProperties(): Promise<any[]>;
    /**
     * ABSENTEE OWNER SCRAPER
     * Finds out-of-state owners (motivated to sell)
     */
    scrapeAbsenteeOwners(): Promise<any[]>;
    private generateRealisticFSBOLeads;
    private generateRealisticExpiredListings;
    private generateHighEquityProperties;
    private generateAbsenteeOwnerProperties;
    private scrapeCountyRecords;
    private findDistressedProperties;
    /**
     * RUN COMPLETE WORKING REAL DATA PIPELINE
     */
    runWorkingRealDataPipeline(): Promise<void>;
}
//# sourceMappingURL=workingRealDataScraper.d.ts.map
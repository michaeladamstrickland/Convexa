interface PropertyListing {
    address: string;
    zipCode: string;
    owner: string;
    phone?: string;
    propertyValue: number;
    leadType: string;
    motivation: string;
    distressScore: number;
    notes: string;
}
export declare class ZipCodeLeadGenerator {
    private db;
    private targetZipCodes;
    constructor();
    /**
     * Search specific zip code for all types of leads
     */
    searchZipCode(zipCode: string): Promise<PropertyListing[]>;
    /**
     * Search multiple zip codes in your target area
     */
    searchTargetArea(zipCodes?: string[]): Promise<void>;
    private searchProbateByZip;
    private searchFSBOByZip;
    private searchExpiredByZip;
    private searchViolationsByZip;
    private searchTaxDelinquentByZip;
    private searchHighEquityByZip;
    private searchAbsenteeByZip;
    private generateProbateForZip;
    private generateFSBOForZip;
    private generateExpiredForZip;
    private generateViolationsForZip;
    private generateTaxDelinquentForZip;
    private generateHighEquityForZip;
    private generateAbsenteeForZip;
    private getZipCodeInfo;
    private getStreetNamesForZip;
    private generatePropertyValue;
    private generateRandomName;
    private generatePhoneNumber;
    private saveLeadToDatabase;
    private delay;
    /**
     * Get summary of leads by zip code
     */
    getLeadsByZipCode(): Promise<void>;
}
export {};
//# sourceMappingURL=zipCodeLeadGenerator.d.ts.map
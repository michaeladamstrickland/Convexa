import { DeathIntelligence } from '../types/index';
export declare class ObituaryDeathMiner {
    private openai;
    private sources;
    constructor();
    mineDeathIntelligence(markets: string[]): Promise<DeathIntelligence[]>;
    private scrapeLegacyDotCom;
    private scrapeLocalNewspapers;
    private scrapeNewspaperSite;
    private scrapeFuneralHomes;
    private parseObituaryFeeds;
    private consolidateDeathRecords;
    private enrichWithPropertyIntelligence;
    private identifyHeirs;
    private findDeceasedProperties;
    private skipTraceHeirs;
    private detectPostDeathVacancy;
    private estimateEstateValue;
    private calculateProbateFilingProbability;
    private createRecordKey;
    private mergeRecords;
    private extractDate;
    private extractLocation;
    private extractAge;
    private searchForNewspaperSites;
    private findLocalFuneralHomes;
    private scrapeFuneralHomeSite;
    private findObituaryFeeds;
    private parseRSSFeed;
    executeMining(markets?: string[]): Promise<void>;
}
//# sourceMappingURL=obituaryDeathMiner.d.ts.map
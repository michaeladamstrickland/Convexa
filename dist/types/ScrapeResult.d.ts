/**
 * ScrapeResult.ts
 * Defines the standard output contract for all scrapers in FlipTracker
 */
/**
 * Types of distress signals that indicate motivated seller potential
 */
export type DistressSignal = "FSBO" | "CODE_VIOLATION" | "TAX_DELINQUENT" | "PROBATE" | "EVICTION" | "PRE_FORECLOSURE" | "AUCTION";
/**
 * Contact information extracted from property listings
 */
export interface ScrapedContact {
    type: "phone" | "email";
    value: string;
    confidence?: number;
    source?: string;
}
/**
 * Property attachment (images, documents)
 */
export interface ScrapedAttachment {
    kind: "img" | "pdf" | "html";
    url?: string;
    sha256?: string;
    data?: string;
}
/**
 * Core property data structure with unified fields
 */
export interface ScrapedProperty {
    sourceKey: string;
    sourceUrl?: string;
    capturedAt: string;
    address: {
        line1: string;
        city?: string;
        state?: string;
        zip?: string;
    };
    parcelId?: string;
    apn?: string;
    ownerName?: string;
    attributes?: Record<string, string | number | boolean | null>;
    priceHint?: number;
    lastEventDate?: string;
    distressSignals: DistressSignal[];
    contacts?: ScrapedContact[];
    attachments?: ScrapedAttachment[];
}
/**
 * Complete scrape result with status and items
 */
export interface ScrapeResult {
    ok: boolean;
    errors?: string[];
    items: ScrapedProperty[];
    scraperId?: string;
    scrapeStartTime?: string;
    scrapeEndTime?: string;
    totalPagesProcessed?: number;
}
//# sourceMappingURL=ScrapeResult.d.ts.map
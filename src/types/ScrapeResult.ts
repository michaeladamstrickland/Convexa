/**
 * ScrapeResult.ts
 * Defines the standard output contract for all scrapers in FlipTracker
 */

/**
 * Types of distress signals that indicate motivated seller potential
 */
export type DistressSignal =
  | "FSBO" 
  | "CODE_VIOLATION" 
  | "TAX_DELINQUENT"
  | "PROBATE" 
  | "EVICTION" 
  | "PRE_FORECLOSURE" 
  | "AUCTION";

/**
 * Contact information extracted from property listings
 */
export interface ScrapedContact {
  type: "phone" | "email";
  value: string;
  confidence?: number;     // 0..1
  source?: string;
}

/**
 * Property attachment (images, documents)
 */
export interface ScrapedAttachment {
  kind: "img" | "pdf" | "html";
  url?: string;
  sha256?: string;
  data?: string;           // Base64 encoded if embedded
}

/**
 * Core property data structure with unified fields
 */
export interface ScrapedProperty {
  // Source metadata
  sourceKey: string;       // e.g. "zillow-fsbo", "cook-county-probate"
  sourceUrl?: string;
  capturedAt: string;      // ISO timestamp

  // Location
  address: { 
    line1: string; 
    city?: string; 
    state?: string; 
    zip?: string 
  };
  
  // Identifiers
  parcelId?: string; 
  apn?: string;
  
  // Ownership
  ownerName?: string;
  
  // Property details
  attributes?: Record<string, string | number | boolean | null>;
  
  // Financial 
  priceHint?: number;      // if listing/auction
  lastEventDate?: string;  // filing/list/auction date
  
  // Distress indicators
  distressSignals: DistressSignal[];
  
  // Contact information
  contacts?: ScrapedContact[];
  
  // Supporting documents
  attachments?: ScrapedAttachment[];
}

/**
 * Complete scrape result with status and items
 */
export interface ScrapeResult {
  ok: boolean;
  errors?: string[];
  items: ScrapedProperty[];
  
  // Additional metadata
  scraperId?: string;
  scrapeStartTime?: string;
  scrapeEndTime?: string;
  totalPagesProcessed?: number;
}

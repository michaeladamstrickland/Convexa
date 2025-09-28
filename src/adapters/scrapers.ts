import { z } from 'zod';
// Dynamic requires to avoid TypeScript rootDir boundary issues when compiling the queue worker build.
// These modules live under backend/ which is outside the primary src root for some builds.
// We intentionally use require inside functions so TypeScript doesn't attempt to type-check external paths.

export interface AdapterInput {
  zip: string;
  options?: { maxPages?: number };
  fromDate?: string;
  toDate?: string;
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    beds?: number;
    propertyTypes?: string[];
    minSqft?: number;
  };
}

export interface DispatcherResult {
  items: Array<{ address: string; price: number; url: string; beds?: number; sqft?: number; propertyType?: string; deduped?: boolean }>;
  meta: {
    scrapedCount: number;
    durationMs: number;
    source: string;
    historyMode?: boolean;
    historyWindow?: Array<{ start: string; end: string; items: number }>;
    filtersApplied?: string[];
    filteredOutCount?: number;
    totalItems?: number;
    dedupedCount?: number;
    errorsCount?: number;
    scrapeDurationMs?: number;
    sourceAdapterVersion?: string;
  };
  errors: string[];
}

const ResultSchema = z.object({
  items: z.array(z.object({
    address: z.string().min(3),
    price: z.number().nonnegative().optional().default(0),
    url: z.string().url().or(z.string().min(5)),
    beds: z.number().int().positive().optional(),
    sqft: z.number().int().positive().optional(),
    propertyType: z.string().optional(),
    deduped: z.boolean().optional()
  })),
  meta: z.object({
    scrapedCount: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    source: z.string(),
    historyMode: z.boolean().optional(),
    historyWindow: z.array(z.object({
      start: z.string(),
      end: z.string(),
      items: z.number().int().nonnegative()
    })).optional(),
    filtersApplied: z.array(z.string()).optional(),
    filteredOutCount: z.number().int().nonnegative().optional(),
    totalItems: z.number().int().nonnegative().optional(),
    dedupedCount: z.number().int().nonnegative().optional(),
    errorsCount: z.number().int().nonnegative().optional(),
    scrapeDurationMs: z.number().int().nonnegative().optional(),
    sourceAdapterVersion: z.string().optional()
  }),
  errors: z.array(z.string())
});

function normalizeAddress(listing: any): string | undefined {
  return (
    listing.propertyAddress ||
    listing.address ||
    listing.addressLine1 ||
    listing.fullAddress ||
    listing.streetAddress ||
    undefined
  );
}

function normalizePrice(listing: any): number {
  const n = listing.listPrice || listing.price || listing.currentBid || listing.startingBid || listing.zestimate || 0;
  return typeof n === 'number' && isFinite(n) ? n : 0;
}

function normalizeBeds(listing: any): number | undefined {
  return listing.beds || listing.bedrooms || listing.numBeds || undefined;
}

function normalizeSqft(listing: any): number | undefined {
  return listing.sqft || listing.livingArea || listing.livingAreaSqFt || listing.squareFeet || undefined;
}

function applyFilters(items: any[], filters?: AdapterInput['filters']) {
  if (!filters) return { filtered: items, applied: [] as string[], filteredOutCount: 0, total: items.length };
  const applied: string[] = [];
  let out = items;
  if (filters.minPrice != null) { applied.push('minPrice'); out = out.filter(i => (i.price ?? 0) >= filters.minPrice!); }
  if (filters.maxPrice != null) { applied.push('maxPrice'); out = out.filter(i => (i.price ?? 0) <= filters.maxPrice!); }
  if (filters.beds != null) { applied.push('beds'); out = out.filter(i => (i.beds ?? 0) >= filters.beds!); }
  if (filters.propertyTypes && filters.propertyTypes.length) { applied.push('propertyTypes'); out = out.filter(i => i.propertyType && filters.propertyTypes!.includes(i.propertyType)); }
  if (filters.minSqft != null) { applied.push('minSqft'); out = out.filter(i => (i.sqft ?? 0) >= filters.minSqft!); }
  return { filtered: out, applied, filteredOutCount: items.length - out.length, total: items.length };
}

function normalizeUrl(listing: any): string | undefined {
  return listing.listingUrl || listing.url || listing.detailUrl || listing.pageUrl || undefined;
}

async function withBrowser<T>(fn: () => Promise<T>, close: () => Promise<any> | void): Promise<T> {
  try {
    return await fn();
  } finally {
    try { await close(); } catch { /* ignore */ }
  }
}

export async function runZillowScraper(input: AdapterInput): Promise<DispatcherResult> {
  const start = Date.now();
  const maxPages = input.options?.maxPages ?? 3;
  const zip = input.zip;
  const errors: string[] = [];

  // Allow disabling heavy browser scrapes for local fast dev
  if (process.env.USE_REAL_SCRAPERS === 'false') {
    const rawItems = [
      { address: `DEV ${zip} Example 1`, price: 400000, url: `https://example.com/zillow/${zip}/1`, beds: 3, sqft: 1800, propertyType: 'single_family' },
      { address: `DEV ${zip} Example 2`, price: 395000, url: `https://example.com/zillow/${zip}/2`, beds: 2, sqft: 1400, propertyType: 'townhome' }
    ];
    const { filtered, applied, filteredOutCount, total } = applyFilters(rawItems, input.filters);
    return {
      items: filtered,
      meta: {
        scrapedCount: filtered.length,
        durationMs: Date.now() - start,
        source: 'zillow',
        filtersApplied: applied,
        filteredOutCount,
        totalItems: total,
        errorsCount: errors.length,
        scrapeDurationMs: Date.now() - start,
        sourceAdapterVersion: 'zillow@1.0.0'
      },
      errors
    };
  }

  // If real scrapers are requested but module missing, downgrade to dev mode
  let realMode = process.env.USE_REAL_SCRAPERS !== 'false';
  // lazy load
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let zillowScraper: any;
  try {
    ({ zillowScraper } = require('../../backend/src/scrapers/zillowScraper'));
  } catch {
    realMode = false;
  }
  if (!realMode) {
    const rawItems = [
      { address: `FAKE ${zip} Zillow 1`, price: 410000, url: `https://example.com/zillow/${zip}/f1`, beds: 3, sqft: 1700, propertyType: 'single_family' },
      { address: `FAKE ${zip} Zillow 2`, price: 405000, url: `https://example.com/zillow/${zip}/f2`, beds: 2, sqft: 1250, propertyType: 'townhome' }
    ];
    const { filtered, applied, filteredOutCount, total } = applyFilters(rawItems, input.filters);
    return {
      items: filtered,
      meta: {
        scrapedCount: filtered.length,
        durationMs: Date.now() - start,
        source: 'zillow',
        filtersApplied: applied,
        filteredOutCount,
        totalItems: total,
        errorsCount: 0,
        scrapeDurationMs: Date.now() - start,
        sourceAdapterVersion: 'zillow@stub'
      },
      errors: []
    };
  }
  await zillowScraper.initialize?.().catch((e: any) => { errors.push(`scrape_error:init_failed:${e.message}`); });

  const listings = await withBrowser(
    async () => {
      try {
        // runFullScrape expects array of zip codes
        const data: any[] = await zillowScraper.runFullScrape([zip], maxPages);
        return Array.isArray(data) ? data : [];
      } catch (e: any) {
        errors.push(`scrape_error:run_failed:${e.message}`);
        return [];
      }
    },
  () => zillowScraper.close?.()
  );

  let items = listings.map(l => ({
    address: normalizeAddress(l) || 'Unknown Address',
    price: normalizePrice(l),
    url: normalizeUrl(l) || 'https://unknown',
    beds: normalizeBeds(l),
    sqft: normalizeSqft(l),
    propertyType: l.propertyType || l.homeType
  })).filter(i => i.address && i.url);
  const { filtered, applied, filteredOutCount, total } = applyFilters(items, input.filters);
  items = filtered;

  const result: DispatcherResult = {
    items,
    meta: {
      scrapedCount: items.length,
      durationMs: Date.now() - start,
      source: 'zillow',
      filtersApplied: applied,
      filteredOutCount,
      totalItems: total,
      errorsCount: errors.length,
      scrapeDurationMs: Date.now() - start,
      sourceAdapterVersion: 'zillow@1.0.0'
    },
    errors
  };

  // Validation; throw classification-friendly error
  try {
    ResultSchema.parse(result);
  } catch (e: any) {
    throw new Error(`validation_error:zillow_result_invalid:${e.message}`);
  }
  return result;
}

export async function runAuctionScraper(input: AdapterInput): Promise<DispatcherResult> {
  const start = Date.now();
  const maxPages = input.options?.maxPages ?? 3;
  const location = input.zip; // treat zip as location hint
  const errors: string[] = [];

  if (process.env.USE_REAL_SCRAPERS === 'false') {
    const rawItems = [ { address: `Auction ${location} Court House`, price: 210000, url: `https://example.com/auction/${location}/1`, beds: 3, sqft: 1600, propertyType: 'foreclosure' } ];
    const { filtered, applied, filteredOutCount, total } = applyFilters(rawItems, input.filters);
    return {
      items: filtered,
      meta: {
        scrapedCount: filtered.length,
        durationMs: Date.now() - start,
        source: 'auction',
        filtersApplied: applied,
        filteredOutCount,
        totalItems: total,
        errorsCount: errors.length,
        scrapeDurationMs: Date.now() - start,
        sourceAdapterVersion: 'auction@1.0.0'
      },
      errors
    };
  }

  let realMode = process.env.USE_REAL_SCRAPERS !== 'false';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let auctionDotComScraper: any;
  try {
    ({ auctionDotComScraper } = require('../../backend/src/scrapers/auctionScraper'));
  } catch {
    realMode = false;
  }
  if (!realMode) {
    const rawItems = [ { address: `FAKE Auction ${location} Courthouse`, price: 205000, url: `https://example.com/auction/${location}/f1`, beds: 3, sqft: 1500, propertyType: 'foreclosure' } ];
    const { filtered, applied, filteredOutCount, total } = applyFilters(rawItems, input.filters);
    return {
      items: filtered,
      meta: {
        scrapedCount: filtered.length,
        durationMs: Date.now() - start,
        source: 'auction',
        filtersApplied: applied,
        filteredOutCount,
        totalItems: total,
        errorsCount: 0,
        scrapeDurationMs: Date.now() - start,
        sourceAdapterVersion: 'auction@stub'
      },
      errors: []
    };
  }
  await auctionDotComScraper.initialize?.().catch((e: any) => { errors.push(`scrape_error:init_failed:${e.message}`); });

  const listings = await withBrowser(
    async () => {
      try {
        const data: any[] = await auctionDotComScraper.searchListingsByLocation([location], maxPages);
        return Array.isArray(data) ? data : [];
      } catch (e: any) {
        errors.push(`scrape_error:run_failed:${e.message}`);
        return [];
      }
    },
    () => auctionDotComScraper.close?.()
  );

  let items = listings.map(l => ({
    address: normalizeAddress(l) || 'Unknown Address',
    price: normalizePrice(l),
    url: normalizeUrl(l) || 'https://unknown',
    beds: normalizeBeds(l),
    sqft: normalizeSqft(l),
    propertyType: l.propertyType
  })).filter(i => i.address && i.url);
  const { filtered, applied, filteredOutCount, total } = applyFilters(items, input.filters);
  items = filtered;

  const result: DispatcherResult = {
    items,
    meta: {
      scrapedCount: items.length,
      durationMs: Date.now() - start,
      source: 'auction',
      filtersApplied: applied,
      filteredOutCount,
      totalItems: total,
      errorsCount: errors.length,
      scrapeDurationMs: Date.now() - start,
      sourceAdapterVersion: 'auction@1.0.0'
    },
    errors
  };

  try {
    ResultSchema.parse(result);
  } catch (e: any) {
    throw new Error(`validation_error:auction_result_invalid:${e.message}`);
  }
  return result;
}

export const _internalSchemas = { ResultSchema };

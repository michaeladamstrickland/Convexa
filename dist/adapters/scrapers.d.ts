import { z } from 'zod';
export interface AdapterInput {
    zip: string;
    options?: {
        maxPages?: number;
    };
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
    items: Array<{
        address: string;
        price: number;
        url: string;
        beds?: number;
        sqft?: number;
        propertyType?: string;
        deduped?: boolean;
    }>;
    meta: {
        scrapedCount: number;
        durationMs: number;
        source: string;
        historyMode?: boolean;
        historyWindow?: Array<{
            start: string;
            end: string;
            items: number;
        }>;
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
export declare function runZillowScraper(input: AdapterInput): Promise<DispatcherResult>;
export declare function runAuctionScraper(input: AdapterInput): Promise<DispatcherResult>;
export declare const _internalSchemas: {
    ResultSchema: z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            address: z.ZodString;
            price: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            url: z.ZodUnion<[z.ZodString, z.ZodString]>;
            beds: z.ZodOptional<z.ZodNumber>;
            sqft: z.ZodOptional<z.ZodNumber>;
            propertyType: z.ZodOptional<z.ZodString>;
            deduped: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            address: string;
            price: number;
            propertyType?: string | undefined;
            beds?: number | undefined;
            sqft?: number | undefined;
            deduped?: boolean | undefined;
        }, {
            url: string;
            address: string;
            propertyType?: string | undefined;
            beds?: number | undefined;
            price?: number | undefined;
            sqft?: number | undefined;
            deduped?: boolean | undefined;
        }>, "many">;
        meta: z.ZodObject<{
            scrapedCount: z.ZodNumber;
            durationMs: z.ZodNumber;
            source: z.ZodString;
            historyMode: z.ZodOptional<z.ZodBoolean>;
            historyWindow: z.ZodOptional<z.ZodArray<z.ZodObject<{
                start: z.ZodString;
                end: z.ZodString;
                items: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                end: string;
                items: number;
                start: string;
            }, {
                end: string;
                items: number;
                start: string;
            }>, "many">>;
            filtersApplied: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            filteredOutCount: z.ZodOptional<z.ZodNumber>;
            totalItems: z.ZodOptional<z.ZodNumber>;
            dedupedCount: z.ZodOptional<z.ZodNumber>;
            errorsCount: z.ZodOptional<z.ZodNumber>;
            scrapeDurationMs: z.ZodOptional<z.ZodNumber>;
            sourceAdapterVersion: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            source: string;
            scrapedCount: number;
            durationMs: number;
            historyMode?: boolean | undefined;
            historyWindow?: {
                end: string;
                items: number;
                start: string;
            }[] | undefined;
            filtersApplied?: string[] | undefined;
            filteredOutCount?: number | undefined;
            totalItems?: number | undefined;
            dedupedCount?: number | undefined;
            errorsCount?: number | undefined;
            scrapeDurationMs?: number | undefined;
            sourceAdapterVersion?: string | undefined;
        }, {
            source: string;
            scrapedCount: number;
            durationMs: number;
            historyMode?: boolean | undefined;
            historyWindow?: {
                end: string;
                items: number;
                start: string;
            }[] | undefined;
            filtersApplied?: string[] | undefined;
            filteredOutCount?: number | undefined;
            totalItems?: number | undefined;
            dedupedCount?: number | undefined;
            errorsCount?: number | undefined;
            scrapeDurationMs?: number | undefined;
            sourceAdapterVersion?: string | undefined;
        }>;
        errors: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        errors: string[];
        items: {
            url: string;
            address: string;
            price: number;
            propertyType?: string | undefined;
            beds?: number | undefined;
            sqft?: number | undefined;
            deduped?: boolean | undefined;
        }[];
        meta: {
            source: string;
            scrapedCount: number;
            durationMs: number;
            historyMode?: boolean | undefined;
            historyWindow?: {
                end: string;
                items: number;
                start: string;
            }[] | undefined;
            filtersApplied?: string[] | undefined;
            filteredOutCount?: number | undefined;
            totalItems?: number | undefined;
            dedupedCount?: number | undefined;
            errorsCount?: number | undefined;
            scrapeDurationMs?: number | undefined;
            sourceAdapterVersion?: string | undefined;
        };
    }, {
        errors: string[];
        items: {
            url: string;
            address: string;
            propertyType?: string | undefined;
            beds?: number | undefined;
            price?: number | undefined;
            sqft?: number | undefined;
            deduped?: boolean | undefined;
        }[];
        meta: {
            source: string;
            scrapedCount: number;
            durationMs: number;
            historyMode?: boolean | undefined;
            historyWindow?: {
                end: string;
                items: number;
                start: string;
            }[] | undefined;
            filtersApplied?: string[] | undefined;
            filteredOutCount?: number | undefined;
            totalItems?: number | undefined;
            dedupedCount?: number | undefined;
            errorsCount?: number | undefined;
            scrapeDurationMs?: number | undefined;
            sourceAdapterVersion?: string | undefined;
        };
    }>;
};
//# sourceMappingURL=scrapers.d.ts.map
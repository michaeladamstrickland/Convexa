import { z } from 'zod';
export declare const ScraperJobPayload: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    source: z.ZodEnum<["zillow", "auction"]>;
    zip: z.ZodString;
    fromDate: z.ZodOptional<z.ZodString>;
    toDate: z.ZodOptional<z.ZodString>;
    filters: z.ZodOptional<z.ZodObject<{
        minPrice: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        maxPrice: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        beds: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        propertyTypes: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        minSqft: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
        beds?: number | undefined;
        propertyTypes?: string[] | undefined;
        minSqft?: number | undefined;
    }, {
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
        beds?: number | undefined;
        propertyTypes?: string[] | undefined;
        minSqft?: number | undefined;
    }>>;
    options: z.ZodDefault<z.ZodObject<{
        maxPages: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        maxPages?: number | undefined;
    }, {
        maxPages?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    options: {
        maxPages?: number | undefined;
    };
    source: "auction" | "zillow";
    zip: string;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    filters?: {
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
        beds?: number | undefined;
        propertyTypes?: string[] | undefined;
        minSqft?: number | undefined;
    } | undefined;
}, {
    source: "auction" | "zillow";
    zip: string;
    options?: {
        maxPages?: number | undefined;
    } | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    filters?: {
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
        beds?: number | undefined;
        propertyTypes?: string[] | undefined;
        minSqft?: number | undefined;
    } | undefined;
}>, {
    options: {
        maxPages?: number | undefined;
    };
    source: "auction" | "zillow";
    zip: string;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    filters?: {
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
        beds?: number | undefined;
        propertyTypes?: string[] | undefined;
        minSqft?: number | undefined;
    } | undefined;
}, {
    source: "auction" | "zillow";
    zip: string;
    options?: {
        maxPages?: number | undefined;
    } | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    filters?: {
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
        beds?: number | undefined;
        propertyTypes?: string[] | undefined;
        minSqft?: number | undefined;
    } | undefined;
}>, {
    options: {
        maxPages?: number | undefined;
    };
    source: "auction" | "zillow";
    zip: string;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    filters?: {
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
        beds?: number | undefined;
        propertyTypes?: string[] | undefined;
        minSqft?: number | undefined;
    } | undefined;
}, {
    source: "auction" | "zillow";
    zip: string;
    options?: {
        maxPages?: number | undefined;
    } | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    filters?: {
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
        beds?: number | undefined;
        propertyTypes?: string[] | undefined;
        minSqft?: number | undefined;
    } | undefined;
}>;
export type ScraperJobPayload = z.infer<typeof ScraperJobPayload>;
export declare function parseScraperJobPayload(data: unknown): ScraperJobPayload;
//# sourceMappingURL=JobPayload.d.ts.map
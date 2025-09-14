import { z } from 'zod';
export { ScraperJobPayload, parseScraperJobPayload } from './JobPayload';
export declare const DistressSignalEnum: z.ZodEnum<["FSBO", "AUCTION", "PRE_FORECLOSURE", "CODE_VIOLATION", "TAX_DELINQUENT", "PROBATE", "EVICTION"]>;
export declare const ContactSchema: z.ZodObject<{
    type: z.ZodEnum<["phone", "email"]>;
    value: z.ZodString;
    confidence: z.ZodOptional<z.ZodNumber>;
    source: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "phone" | "email";
    value: string;
    source?: string | undefined;
    confidence?: number | undefined;
}, {
    type: "phone" | "email";
    value: string;
    source?: string | undefined;
    confidence?: number | undefined;
}>;
export declare const ScrapedProperty: z.ZodObject<{
    sourceKey: z.ZodUnion<[z.ZodEnum<["zillow", "auction-com"]>, z.ZodString]>;
    capturedAt: z.ZodString;
    address: z.ZodObject<{
        line1: z.ZodString;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zip: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }, {
        line1: string;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    }>;
    parcelId: z.ZodOptional<z.ZodString>;
    apn: z.ZodOptional<z.ZodString>;
    ownerName: z.ZodOptional<z.ZodString>;
    attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    priceHint: z.ZodOptional<z.ZodNumber>;
    lastEventDate: z.ZodOptional<z.ZodString>;
    distressSignals: z.ZodDefault<z.ZodArray<z.ZodEnum<["FSBO", "AUCTION", "PRE_FORECLOSURE", "CODE_VIOLATION", "TAX_DELINQUENT", "PROBATE", "EVICTION"]>, "many">>;
    contacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["phone", "email"]>;
        value: z.ZodString;
        confidence: z.ZodOptional<z.ZodNumber>;
        source: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "phone" | "email";
        value: string;
        source?: string | undefined;
        confidence?: number | undefined;
    }, {
        type: "phone" | "email";
        value: string;
        source?: string | undefined;
        confidence?: number | undefined;
    }>, "many">>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["img", "pdf", "html"]>;
        s3Key: z.ZodOptional<z.ZodString>;
        sha256: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "html" | "img" | "pdf";
        s3Key?: string | undefined;
        sha256?: string | undefined;
    }, {
        kind: "html" | "img" | "pdf";
        s3Key?: string | undefined;
        sha256?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    address: {
        line1: string;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    };
    sourceKey: string;
    capturedAt: string;
    distressSignals: ("FSBO" | "AUCTION" | "PRE_FORECLOSURE" | "CODE_VIOLATION" | "TAX_DELINQUENT" | "PROBATE" | "EVICTION")[];
    ownerName?: string | undefined;
    parcelId?: string | undefined;
    apn?: string | undefined;
    attributes?: Record<string, any> | undefined;
    priceHint?: number | undefined;
    lastEventDate?: string | undefined;
    contacts?: {
        type: "phone" | "email";
        value: string;
        source?: string | undefined;
        confidence?: number | undefined;
    }[] | undefined;
    attachments?: {
        kind: "html" | "img" | "pdf";
        s3Key?: string | undefined;
        sha256?: string | undefined;
    }[] | undefined;
}, {
    address: {
        line1: string;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    };
    sourceKey: string;
    capturedAt: string;
    ownerName?: string | undefined;
    parcelId?: string | undefined;
    apn?: string | undefined;
    attributes?: Record<string, any> | undefined;
    priceHint?: number | undefined;
    lastEventDate?: string | undefined;
    distressSignals?: ("FSBO" | "AUCTION" | "PRE_FORECLOSURE" | "CODE_VIOLATION" | "TAX_DELINQUENT" | "PROBATE" | "EVICTION")[] | undefined;
    contacts?: {
        type: "phone" | "email";
        value: string;
        source?: string | undefined;
        confidence?: number | undefined;
    }[] | undefined;
    attachments?: {
        kind: "html" | "img" | "pdf";
        s3Key?: string | undefined;
        sha256?: string | undefined;
    }[] | undefined;
}>;
export type ScrapedProperty = z.infer<typeof ScrapedProperty>;
export declare const ScrapeResult: z.ZodObject<{
    ok: z.ZodBoolean;
    errors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    items: z.ZodArray<z.ZodObject<{
        sourceKey: z.ZodUnion<[z.ZodEnum<["zillow", "auction-com"]>, z.ZodString]>;
        capturedAt: z.ZodString;
        address: z.ZodObject<{
            line1: z.ZodString;
            city: z.ZodOptional<z.ZodString>;
            state: z.ZodOptional<z.ZodString>;
            zip: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            line1: string;
            city?: string | undefined;
            state?: string | undefined;
            zip?: string | undefined;
        }, {
            line1: string;
            city?: string | undefined;
            state?: string | undefined;
            zip?: string | undefined;
        }>;
        parcelId: z.ZodOptional<z.ZodString>;
        apn: z.ZodOptional<z.ZodString>;
        ownerName: z.ZodOptional<z.ZodString>;
        attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        priceHint: z.ZodOptional<z.ZodNumber>;
        lastEventDate: z.ZodOptional<z.ZodString>;
        distressSignals: z.ZodDefault<z.ZodArray<z.ZodEnum<["FSBO", "AUCTION", "PRE_FORECLOSURE", "CODE_VIOLATION", "TAX_DELINQUENT", "PROBATE", "EVICTION"]>, "many">>;
        contacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["phone", "email"]>;
            value: z.ZodString;
            confidence: z.ZodOptional<z.ZodNumber>;
            source: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "phone" | "email";
            value: string;
            source?: string | undefined;
            confidence?: number | undefined;
        }, {
            type: "phone" | "email";
            value: string;
            source?: string | undefined;
            confidence?: number | undefined;
        }>, "many">>;
        attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["img", "pdf", "html"]>;
            s3Key: z.ZodOptional<z.ZodString>;
            sha256: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "html" | "img" | "pdf";
            s3Key?: string | undefined;
            sha256?: string | undefined;
        }, {
            kind: "html" | "img" | "pdf";
            s3Key?: string | undefined;
            sha256?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        address: {
            line1: string;
            city?: string | undefined;
            state?: string | undefined;
            zip?: string | undefined;
        };
        sourceKey: string;
        capturedAt: string;
        distressSignals: ("FSBO" | "AUCTION" | "PRE_FORECLOSURE" | "CODE_VIOLATION" | "TAX_DELINQUENT" | "PROBATE" | "EVICTION")[];
        ownerName?: string | undefined;
        parcelId?: string | undefined;
        apn?: string | undefined;
        attributes?: Record<string, any> | undefined;
        priceHint?: number | undefined;
        lastEventDate?: string | undefined;
        contacts?: {
            type: "phone" | "email";
            value: string;
            source?: string | undefined;
            confidence?: number | undefined;
        }[] | undefined;
        attachments?: {
            kind: "html" | "img" | "pdf";
            s3Key?: string | undefined;
            sha256?: string | undefined;
        }[] | undefined;
    }, {
        address: {
            line1: string;
            city?: string | undefined;
            state?: string | undefined;
            zip?: string | undefined;
        };
        sourceKey: string;
        capturedAt: string;
        ownerName?: string | undefined;
        parcelId?: string | undefined;
        apn?: string | undefined;
        attributes?: Record<string, any> | undefined;
        priceHint?: number | undefined;
        lastEventDate?: string | undefined;
        distressSignals?: ("FSBO" | "AUCTION" | "PRE_FORECLOSURE" | "CODE_VIOLATION" | "TAX_DELINQUENT" | "PROBATE" | "EVICTION")[] | undefined;
        contacts?: {
            type: "phone" | "email";
            value: string;
            source?: string | undefined;
            confidence?: number | undefined;
        }[] | undefined;
        attachments?: {
            kind: "html" | "img" | "pdf";
            s3Key?: string | undefined;
            sha256?: string | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    items: {
        address: {
            line1: string;
            city?: string | undefined;
            state?: string | undefined;
            zip?: string | undefined;
        };
        sourceKey: string;
        capturedAt: string;
        distressSignals: ("FSBO" | "AUCTION" | "PRE_FORECLOSURE" | "CODE_VIOLATION" | "TAX_DELINQUENT" | "PROBATE" | "EVICTION")[];
        ownerName?: string | undefined;
        parcelId?: string | undefined;
        apn?: string | undefined;
        attributes?: Record<string, any> | undefined;
        priceHint?: number | undefined;
        lastEventDate?: string | undefined;
        contacts?: {
            type: "phone" | "email";
            value: string;
            source?: string | undefined;
            confidence?: number | undefined;
        }[] | undefined;
        attachments?: {
            kind: "html" | "img" | "pdf";
            s3Key?: string | undefined;
            sha256?: string | undefined;
        }[] | undefined;
    }[];
    errors?: string[] | undefined;
}, {
    ok: boolean;
    items: {
        address: {
            line1: string;
            city?: string | undefined;
            state?: string | undefined;
            zip?: string | undefined;
        };
        sourceKey: string;
        capturedAt: string;
        ownerName?: string | undefined;
        parcelId?: string | undefined;
        apn?: string | undefined;
        attributes?: Record<string, any> | undefined;
        priceHint?: number | undefined;
        lastEventDate?: string | undefined;
        distressSignals?: ("FSBO" | "AUCTION" | "PRE_FORECLOSURE" | "CODE_VIOLATION" | "TAX_DELINQUENT" | "PROBATE" | "EVICTION")[] | undefined;
        contacts?: {
            type: "phone" | "email";
            value: string;
            source?: string | undefined;
            confidence?: number | undefined;
        }[] | undefined;
        attachments?: {
            kind: "html" | "img" | "pdf";
            s3Key?: string | undefined;
            sha256?: string | undefined;
        }[] | undefined;
    }[];
    errors?: string[] | undefined;
}>;
export type ScrapeResult = z.infer<typeof ScrapeResult>;
export declare function parseScrapeResult(data: unknown): ScrapeResult;
export declare function parseScrapedProperty(data: unknown): ScrapedProperty;
//# sourceMappingURL=index.d.ts.map
export type LeadTemperature = "DEAD" | "WARM" | "HOT" | "ON_FIRE";
export interface Comparable {
    address: string;
    distanceMi: number;
    salePrice: number;
    saleDate: string;
    beds: number;
    baths: number;
    sqft: number;
    lotSqft?: number;
    yearBuilt?: number;
    adjustments?: {
        label: string;
        amount: number;
    }[];
    adjustedPrice?: number;
}
export interface RenoLineItem {
    id: string;
    category: "Exterior" | "Interior" | "Systems" | "Contingency" | "Other";
    name: string;
    qty: number;
    unit: "ea" | "sqft" | "lf" | "day";
    unitCost: number;
    subtotal: number;
    notes?: string;
}
export interface DealAnalysis {
    leadId: string;
    source: "ATTOM" | "Scraper" | "Manual";
    temperature: LeadTemperature;
    property: {
        address: string;
        city: string;
        state: string;
        zip: string;
        apn?: string;
        beds?: number;
        baths?: number;
        sqft?: number;
        lotSqft?: number;
        yearBuilt?: number;
        attomId?: string;
        estValue?: number;
        arv?: number;
    };
    purchase: {
        offerPrice: number;
        closingCostsPct: number;
        holdingMonths: number;
        rateAPR?: number;
        sellingCostsPct: number;
    };
    renovation: {
        budget: number;
        lineItems: RenoLineItem[];
    };
    comps: Comparable[];
    results: {
        totalInvestment: number;
        netProfit: number;
        roiPct: number;
        riskScore: number;
        recommendation: "PASS" | "REVIEW" | "PROCEED";
        notes?: string[];
    };
    createdAt: string;
    updatedAt: string;
}
export declare function computeRoi(arv: number, offer: number, reno: number, closingPct: number, sellingPct: number, holdMonths: number, apr?: number): {
    totalInvestment: number;
    netProfit: number;
    roiPct: number;
};
export declare function computeArvFromComps(subjectSqft: number, comps: Comparable[]): {
    arv: number;
    adjusted: {
        adjustedPrice: number;
        address: string;
        distanceMi: number;
        salePrice: number;
        saleDate: string;
        beds: number;
        baths: number;
        sqft: number;
        lotSqft?: number;
        yearBuilt?: number;
        adjustments?: {
            label: string;
            amount: number;
        }[];
    }[];
};
export declare function mapAttomToDeal(attomData: any, leadId: string): Partial<DealAnalysis>;
export declare function mapCompsToComparables(attomComps: any[]): Comparable[];
//# sourceMappingURL=deal.d.ts.map
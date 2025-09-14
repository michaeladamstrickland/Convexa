/**
 * Deal Analysis Engine
 * Core service for property investment analysis
 */
export interface RenovationCostModel {
    baseSquareFootCost: number;
    regionMultiplier: Record<string, number>;
    roomTypeCosts: {
        kitchen: {
            basic: number;
            mid: number;
            luxury: number;
        };
        bathroom: {
            basic: number;
            mid: number;
            luxury: number;
        };
        bedroom: {
            basic: number;
            mid: number;
            luxury: number;
        };
        livingSpace: {
            basic: number;
            mid: number;
            luxury: number;
        };
    };
    extraFeatures: Record<string, number>;
}
export interface RenovationEstimate {
    roomBreakdown: Record<string, number>;
    materialsCost: number;
    laborCost: number;
    permitsCost: number;
    contingency: number;
    totalCost: number;
}
export interface ROICalculation {
    purchasePrice: number;
    closingCosts: number;
    renovationCosts: number;
    holdingCosts: {
        monthly: number;
        total: number;
    };
    projectedARV: number;
    sellingCosts: number;
    netProfit: number;
    roi: number;
    cashOnCashReturn?: number;
    timelineImpact: {
        bestCase: number;
        expected: number;
        worstCase: number;
    };
}
export interface ComparableSale {
    propertyId: string;
    address: string;
    saleDate: Date;
    salePrice: number;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    yearBuilt: number;
    lotSize: number;
    adjustments: {
        feature: string;
        amount: number;
        reason: string;
    }[];
    adjustedValue: number;
    distanceFromTarget: number;
    photoUrl?: string;
}
export interface CompAnalysisResult {
    comparableSales: ComparableSale[];
    estimatedARV: number;
    confidenceScore: number;
    adjustmentExplanations: string[];
}
/**
 * Calculate renovation costs based on property attributes and selected renovations
 */
export declare function calculateRenovationCosts(propertyData: {
    zipCode: string;
    squareFootage: number;
    bedrooms: number;
    bathrooms: number;
}, renovationSelections: {
    kitchen?: 'none' | 'basic' | 'mid' | 'luxury';
    bathroom?: 'none' | 'basic' | 'mid' | 'luxury';
    bedroom?: 'none' | 'basic' | 'mid' | 'luxury';
    livingSpace?: 'none' | 'basic' | 'mid' | 'luxury';
    extraFeatures?: string[];
    isDIY?: boolean;
    contingencyPercent?: number;
}): Promise<RenovationEstimate>;
/**
 * Calculate ROI based on purchase price, renovation costs, and projected ARV
 */
export declare function calculateROI(investmentData: {
    purchasePrice: number;
    closingCostPercent?: number;
    renovationCost: number;
    holdingPeriodMonths?: number;
    monthlyHoldingCost?: number;
    projectedARV: number;
    sellingCostPercent?: number;
    downPaymentPercent?: number;
}): ROICalculation;
/**
 * Find comparable properties and calculate ARV using the ATTOM API
 */
export declare function findComparableProperties(propertyData: {
    propertyId?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode: string;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    yearBuilt?: number;
    latitude?: number;
    longitude?: number;
}, options?: {
    maxDistance?: number;
    maxResults?: number;
    monthsBack?: number;
}): Promise<CompAnalysisResult>;
export declare const renovationCostModel: RenovationCostModel;
//# sourceMappingURL=dealAnalysisService.d.ts.map
/**
 * ROI Calculator Service
 * Handles various investment scenario calculations
 */
import { ROICalculation } from './dealAnalysisService';
interface FinancingDetails {
    downPaymentPercent: number;
    interestRate: number;
    loanTermYears: number;
    loanPoints?: number;
    originationFeePercent?: number;
}
interface SensitivityRange {
    min: number;
    expected: number;
    max: number;
}
interface ROIScenario extends ROICalculation {
    name: string;
    description: string;
    assumptions: string[];
    sensitivityAnalysis: {
        purchasePrice: SensitivityRange;
        renovationCost: SensitivityRange;
        projectedARV: SensitivityRange;
        timeToSell: SensitivityRange;
    };
}
/**
 * Calculate monthly mortgage payment
 */
export declare function calculateMonthlyMortgagePayment(loanAmount: number, interestRate: number, termYears: number): number;
/**
 * Calculate financing costs for a property
 */
export declare function calculateFinancingCosts(purchasePrice: number, financingDetails: FinancingDetails): {
    downPayment: number;
    loanAmount: number;
    monthlyPayment: number;
    closingCosts: number;
    totalFinancingCost: number;
};
/**
 * Create different ROI scenarios for comparison
 */
export declare function createROIScenarios(baseData: {
    purchasePrice: number;
    renovationCost: number;
    projectedARV: number;
    zipCode: string;
}): ROIScenario[];
/**
 * Calculate after repair value based on property data and renovation scope
 */
export declare function estimateARV(propertyData: {
    purchasePrice: number;
    zipCode: string;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    yearBuilt?: number;
}, renovationData: {
    kitchen?: boolean;
    bathrooms?: boolean;
    flooring?: boolean;
    paint?: boolean;
    exterior?: boolean;
    landscaping?: boolean;
    structural?: boolean;
}): number;
export {};
//# sourceMappingURL=roiCalculator.d.ts.map
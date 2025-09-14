/**
 * Deal Analysis Engine
 * Core service for property investment analysis
 */

import axios from 'axios';
import { getAttomClient } from './attomService';

// Types
export interface RenovationCostModel {
  baseSquareFootCost: number;
  regionMultiplier: Record<string, number>;
  roomTypeCosts: {
    kitchen: { basic: number, mid: number, luxury: number };
    bathroom: { basic: number, mid: number, luxury: number };
    bedroom: { basic: number, mid: number, luxury: number };
    livingSpace: { basic: number, mid: number, luxury: number };
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
  distanceFromTarget: number; // miles
  photoUrl?: string;
}

export interface CompAnalysisResult {
  comparableSales: ComparableSale[];
  estimatedARV: number;
  confidenceScore: number; // 0-100
  adjustmentExplanations: string[];
}

// Default cost models
const DEFAULT_RENOVATION_COST_MODEL: RenovationCostModel = {
  baseSquareFootCost: 25, // $25 per sq ft for basic renovation
  regionMultiplier: {
    'Northeast': 1.2,
    'Midwest': 0.9,
    'South': 0.85,
    'West': 1.3,
    'Southwest': 0.95,
    'Northwest': 1.15,
    'California': 1.5,
    'Florida': 1.1,
    'Texas': 0.9,
    'New York': 1.4,
  },
  roomTypeCosts: {
    kitchen: { basic: 10000, mid: 25000, luxury: 50000 },
    bathroom: { basic: 5000, mid: 12000, luxury: 25000 },
    bedroom: { basic: 3000, mid: 7500, luxury: 15000 },
    livingSpace: { basic: 5000, mid: 12000, luxury: 20000 },
  },
  extraFeatures: {
    'pool': 35000,
    'deck': 12000,
    'landscaping': 8000,
    'roof': 15000,
    'hvac': 8000,
    'electrical': 10000,
    'plumbing': 12000,
    'windows': 8000,
    'flooring': 7000,
    'painting': 5000,
    'foundation': 20000
  }
};

// Helper function to determine region from ZIP code
async function getRegionFromZip(zipCode: string): Promise<string> {
  // This is a simplification - in a real app you'd have a proper ZIP code to region mapping
  // or use a geocoding service
  const firstDigit = parseInt(zipCode[0]);
  
  switch(firstDigit) {
    case 0:
    case 1:
      return 'Northeast';
    case 2:
      return 'New York';  
    case 3:
      return 'South';
    case 4:
      return 'Midwest';
    case 5:
      return 'Midwest';
    case 6:
      return 'Southwest';
    case 7:
      return 'Texas';
    case 8:
      return 'West';
    case 9:
      if (zipCode.startsWith('9') && zipCode.length >= 3 && parseInt(zipCode.substring(0, 3)) <= 961) {
        return 'California';
      }
      return 'Northwest';
    default:
      return 'Midwest'; // Default fallback
  }
}

/**
 * Calculate renovation costs based on property attributes and selected renovations
 */
export async function calculateRenovationCosts(
  propertyData: {
    zipCode: string;
    squareFootage: number;
    bedrooms: number;
    bathrooms: number;
  },
  renovationSelections: {
    kitchen?: 'none' | 'basic' | 'mid' | 'luxury';
    bathroom?: 'none' | 'basic' | 'mid' | 'luxury';
    bedroom?: 'none' | 'basic' | 'mid' | 'luxury';
    livingSpace?: 'none' | 'basic' | 'mid' | 'luxury';
    extraFeatures?: string[];
    isDIY?: boolean;
    contingencyPercent?: number;
  }
): Promise<RenovationEstimate> {
  try {
    const { zipCode, squareFootage, bedrooms, bathrooms } = propertyData;
    const { kitchen, bathroom, bedroom, livingSpace, extraFeatures, isDIY, contingencyPercent = 10 } = renovationSelections;
    
    // Get region for cost adjustment
    const region = await getRegionFromZip(zipCode);
    const regionMultiplier = DEFAULT_RENOVATION_COST_MODEL.regionMultiplier[region] || 1.0;
    
    // Base renovation cost
    let baseCost = squareFootage * DEFAULT_RENOVATION_COST_MODEL.baseSquareFootCost * regionMultiplier;
    
    // Room-specific costs
    const roomBreakdown: Record<string, number> = {};
    
    // Kitchen renovation
    if (kitchen && kitchen !== 'none') {
      roomBreakdown['kitchen'] = DEFAULT_RENOVATION_COST_MODEL.roomTypeCosts.kitchen[kitchen] * regionMultiplier;
      baseCost += roomBreakdown['kitchen'];
    }
    
    // Bathroom renovation (multiply by number of bathrooms if needed)
    if (bathroom && bathroom !== 'none') {
      roomBreakdown['bathroom'] = DEFAULT_RENOVATION_COST_MODEL.roomTypeCosts.bathroom[bathroom] * bathrooms * regionMultiplier;
      baseCost += roomBreakdown['bathroom'];
    }
    
    // Bedroom renovation (multiply by number of bedrooms if needed)
    if (bedroom && bedroom !== 'none') {
      roomBreakdown['bedroom'] = DEFAULT_RENOVATION_COST_MODEL.roomTypeCosts.bedroom[bedroom] * bedrooms * regionMultiplier;
      baseCost += roomBreakdown['bedroom'];
    }
    
    // Living space renovation
    if (livingSpace && livingSpace !== 'none') {
      roomBreakdown['livingSpace'] = DEFAULT_RENOVATION_COST_MODEL.roomTypeCosts.livingSpace[livingSpace] * regionMultiplier;
      baseCost += roomBreakdown['livingSpace'];
    }
    
    // Extra features
    if (extraFeatures && extraFeatures.length > 0) {
      extraFeatures.forEach(feature => {
        if (DEFAULT_RENOVATION_COST_MODEL.extraFeatures[feature]) {
          roomBreakdown[feature] = DEFAULT_RENOVATION_COST_MODEL.extraFeatures[feature] * regionMultiplier;
          baseCost += roomBreakdown[feature];
        }
      });
    }
    
    // Calculate labor vs. materials split (simplification)
    const materialsCost = baseCost * 0.4;
    const laborCost = baseCost * 0.5;
    const permitsCost = baseCost * 0.1;
    
    // Apply DIY discount to labor if applicable
    const adjustedLaborCost = isDIY ? laborCost * 0.3 : laborCost; // DIY saves 70% on labor
    
    // Calculate total cost before contingency
    let totalBeforeContingency = materialsCost + adjustedLaborCost + permitsCost;
    
    // Add contingency
    const contingencyAmount = totalBeforeContingency * (contingencyPercent / 100);
    const totalCost = totalBeforeContingency + contingencyAmount;
    
    return {
      roomBreakdown,
      materialsCost,
      laborCost: adjustedLaborCost,
      permitsCost,
      contingency: contingencyAmount,
      totalCost
    };
  } catch (error) {
    console.error('Error calculating renovation costs:', error);
    throw new Error('Failed to calculate renovation costs');
  }
}

/**
 * Calculate ROI based on purchase price, renovation costs, and projected ARV
 */
export function calculateROI(
  investmentData: {
    purchasePrice: number;
    closingCostPercent?: number;
    renovationCost: number;
    holdingPeriodMonths?: number;
    monthlyHoldingCost?: number;
    projectedARV: number;
    sellingCostPercent?: number;
    downPaymentPercent?: number;
  }
): ROICalculation {
  try {
    const { 
      purchasePrice,
      closingCostPercent = 3,
      renovationCost,
      holdingPeriodMonths = 6,
      monthlyHoldingCost = (purchasePrice * 0.005), // Default 0.5% of purchase price
      projectedARV,
      sellingCostPercent = 8,
      downPaymentPercent
    } = investmentData;
    
    // Calculate closing costs
    const closingCosts = purchasePrice * (closingCostPercent / 100);
    
    // Calculate holding costs
    const monthlyHolding = monthlyHoldingCost;
    const totalHoldingCosts = monthlyHolding * holdingPeriodMonths;
    
    // Calculate selling costs
    const sellingCosts = projectedARV * (sellingCostPercent / 100);
    
    // Calculate total investment
    const totalInvestment = purchasePrice + closingCosts + renovationCost + totalHoldingCosts;
    
    // Calculate net profit
    const netProceeds = projectedARV - sellingCosts;
    const netProfit = netProceeds - totalInvestment;
    
    // Calculate ROI
    const roi = (netProfit / totalInvestment) * 100;
    
    // Calculate cash-on-cash return if financing is used
    let cashOnCashReturn;
    if (downPaymentPercent) {
      const downPayment = purchasePrice * (downPaymentPercent / 100);
      const totalCashInvested = downPayment + closingCosts + renovationCost + totalHoldingCosts;
      cashOnCashReturn = (netProfit / totalCashInvested) * 100;
    }
    
    // Timeline impact (simplified model)
    const bestCase = roi * 1.2; // 20% better than expected
    const worstCase = roi * 0.7; // 30% worse than expected
    
    return {
      purchasePrice,
      closingCosts,
      renovationCosts: renovationCost,
      holdingCosts: {
        monthly: monthlyHolding,
        total: totalHoldingCosts
      },
      projectedARV,
      sellingCosts,
      netProfit,
      roi,
      cashOnCashReturn,
      timelineImpact: {
        bestCase,
        expected: roi,
        worstCase
      }
    };
  } catch (error) {
    console.error('Error calculating ROI:', error);
    throw new Error('Failed to calculate ROI');
  }
}

/**
 * Find comparable properties and calculate ARV using the ATTOM API
 */
export async function findComparableProperties(
  propertyData: {
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
  },
  options: {
    maxDistance?: number; // miles
    maxResults?: number;
    monthsBack?: number;
  } = {}
): Promise<CompAnalysisResult> {
  try {
    const { 
      zipCode, 
      bedrooms, 
      bathrooms, 
      squareFootage,
      latitude,
      longitude 
    } = propertyData;
    
    const {
      maxDistance = 0.5,
      maxResults = 5,
      monthsBack = 6
    } = options;
    
    // Get ATTOM client
    const attomClient = await getAttomClient();
    if (!attomClient) {
      throw new Error('ATTOM API client is not available');
    }
    
    // If we have lat/long, use that for the search, otherwise use zipCode
    let searchParams: any = {};
    if (latitude && longitude) {
      searchParams = {
        latitude,
        longitude,
        radius: maxDistance
      };
    } else {
      searchParams = {
        postalcode: zipCode
      };
    }
    
    // Add parameters for comparable search
    searchParams = {
      ...searchParams,
      minBeds: Math.max(1, bedrooms - 1),
      maxBeds: bedrooms + 1,
      minBaths: Math.max(1, bathrooms - 1),
      maxBaths: bathrooms + 1,
      minSqft: squareFootage * 0.8,
      maxSqft: squareFootage * 1.2,
      pageSize: maxResults * 2, // Get more than we need for filtering
    };
    
    // Search for comparable properties
    const response = await attomClient.get('/propertyapi/v1.0.0/property/snapshot', {
      params: searchParams
    });
    
    // Extract comparable properties
    let comparables: ComparableSale[] = [];
    if (response.data && response.data.property) {
      comparables = response.data.property
        .filter((prop: any) => prop.sale && prop.sale.saleDate)
        .map((prop: any) => {
          // Calculate distance if we have lat/long
          let distance = 0;
          if (latitude && longitude && prop.location.latitude && prop.location.longitude) {
            distance = calculateDistance(
              latitude, 
              longitude, 
              prop.location.latitude, 
              prop.location.longitude
            );
          }
          
          // Create the comparable object
          return {
            propertyId: prop.identifier.obPropId,
            address: `${prop.address.line1}, ${prop.address.locality}, ${prop.address.countrySubd}`,
            saleDate: new Date(prop.sale.saleDate),
            salePrice: prop.sale.amount.value,
            bedrooms: prop.building.rooms.beds || 0,
            bathrooms: prop.building.rooms.bathsFull || 0,
            squareFootage: prop.building.size.universalsize || 0,
            yearBuilt: prop.summary.yearBuilt || 0,
            lotSize: prop.lot.lotsize1 || 0,
            adjustments: [],
            adjustedValue: prop.sale.amount.value,
            distanceFromTarget: distance,
            photoUrl: prop.photo && prop.photo.length > 0 ? prop.photo[0].url : undefined
          };
        })
        .sort((a: ComparableSale, b: ComparableSale) => a.distanceFromTarget - b.distanceFromTarget)
        .slice(0, maxResults);
    }
    
    // Apply adjustments to comparables
    const adjustedComparables = comparables.map((comp: ComparableSale) => {
      const adjustments = [];
      
      // Adjust for square footage differences ($100 per sq ft)
      if (Math.abs(comp.squareFootage - squareFootage) > 100) {
        const sqFtDifference = comp.squareFootage - squareFootage;
        const sqFtAdjustment = sqFtDifference * 100;
        adjustments.push({
          feature: 'squareFootage',
          amount: sqFtAdjustment,
          reason: `${Math.abs(sqFtDifference)} sqft ${sqFtDifference > 0 ? 'larger' : 'smaller'}`
        });
      }
      
      // Adjust for bedroom differences ($10,000 per bedroom)
      if (comp.bedrooms !== bedrooms) {
        const bedDifference = comp.bedrooms - bedrooms;
        const bedAdjustment = bedDifference * 10000;
        adjustments.push({
          feature: 'bedrooms',
          amount: bedAdjustment,
          reason: `${Math.abs(bedDifference)} ${Math.abs(bedDifference) === 1 ? 'bedroom' : 'bedrooms'} ${bedDifference > 0 ? 'more' : 'fewer'}`
        });
      }
      
      // Adjust for bathroom differences ($15,000 per bathroom)
      if (comp.bathrooms !== bathrooms) {
        const bathDifference = comp.bathrooms - bathrooms;
        const bathAdjustment = bathDifference * 15000;
        adjustments.push({
          feature: 'bathrooms',
          amount: bathAdjustment,
          reason: `${Math.abs(bathDifference)} ${Math.abs(bathDifference) === 1 ? 'bathroom' : 'bathrooms'} ${bathDifference > 0 ? 'more' : 'fewer'}`
        });
      }
      
      // Calculate total adjustments
      const totalAdjustment = adjustments.reduce((sum, adj) => sum + adj.amount, 0);
      const adjustedValue = comp.salePrice - totalAdjustment;
      
      return {
        ...comp,
        adjustments,
        adjustedValue
      };
    });
    
    // Calculate estimated ARV (weighted average of adjusted values)
    const totalWeight = adjustedComparables.reduce((sum, comp, index) => {
      // Closer comps and more recent sales get higher weight
      const distanceWeight = 1 / (comp.distanceFromTarget + 0.1);
      const recencyWeight = 1 / (dateDiffInMonths(new Date(), comp.saleDate) + 1);
      return sum + distanceWeight * recencyWeight;
    }, 0);
    
    const weightedSum = adjustedComparables.reduce((sum, comp, index) => {
      const distanceWeight = 1 / (comp.distanceFromTarget + 0.1);
      const recencyWeight = 1 / (dateDiffInMonths(new Date(), comp.saleDate) + 1);
      const weight = (distanceWeight * recencyWeight) / totalWeight;
      return sum + (comp.adjustedValue * weight);
    }, 0);
    
    const estimatedARV = Math.round(weightedSum);
    
    // Calculate confidence score (0-100) based on number of comps, distance, and recency
    const confidenceScore = calculateConfidenceScore(adjustedComparables);
    
    // Generate adjustment explanations
    const adjustmentExplanations = generateAdjustmentExplanations(adjustedComparables);
    
    return {
      comparableSales: adjustedComparables,
      estimatedARV,
      confidenceScore,
      adjustmentExplanations
    };
  } catch (error) {
    console.error('Error finding comparable properties:', error);
    throw new Error('Failed to find comparable properties');
  }
}

// Helper function to calculate distance between two points (using Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

// Helper function to calculate difference in months between two dates
function dateDiffInMonths(date1: Date, date2: Date): number {
  const monthDiff = date1.getMonth() - date2.getMonth();
  const yearDiff = date1.getFullYear() - date2.getFullYear();
  
  return monthDiff + yearDiff * 12;
}

// Helper function to calculate confidence score
function calculateConfidenceScore(comparables: ComparableSale[]): number {
  if (comparables.length === 0) return 0;
  
  // Base score depends on number of comparables
  const countScore = Math.min(comparables.length * 20, 60);
  
  // Distance score
  const avgDistance = comparables.reduce((sum, comp) => sum + comp.distanceFromTarget, 0) / comparables.length;
  const distanceScore = Math.max(0, 20 - (avgDistance * 20));
  
  // Recency score
  const avgMonthsAgo = comparables.reduce((sum, comp) => sum + dateDiffInMonths(new Date(), comp.saleDate), 0) / comparables.length;
  const recencyScore = Math.max(0, 20 - (avgMonthsAgo * 2));
  
  return Math.min(100, countScore + distanceScore + recencyScore);
}

// Helper function to generate adjustment explanations
function generateAdjustmentExplanations(comparables: ComparableSale[]): string[] {
  const explanations: string[] = [];
  
  if (comparables.length === 0) {
    explanations.push("No comparable properties were found.");
    return explanations;
  }
  
  const totalAdjustments = comparables.reduce((sum, comp) => {
    return sum + comp.adjustments.reduce((adjSum, adj) => adjSum + Math.abs(adj.amount), 0);
  }, 0);
  
  const avgAdjustment = totalAdjustments / comparables.length;
  
  explanations.push(`Found ${comparables.length} comparable properties.`);
  explanations.push(`Average adjustment per property: $${Math.round(avgAdjustment).toLocaleString()}.`);
  
  // Most common adjustments
  const adjustmentTypes = new Map<string, number>();
  comparables.forEach(comp => {
    comp.adjustments.forEach(adj => {
      adjustmentTypes.set(adj.feature, (adjustmentTypes.get(adj.feature) || 0) + 1);
    });
  });
  
  if (adjustmentTypes.size > 0) {
    const mostCommon = [...adjustmentTypes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([feature, count]) => `${feature} (${count}/${comparables.length})`)
      .join(" and ");
    
    explanations.push(`Most common adjustments were for ${mostCommon}.`);
  }
  
  // Confidence explanation
  const confidenceScore = calculateConfidenceScore(comparables);
  if (confidenceScore >= 80) {
    explanations.push("High confidence in ARV estimate due to good comparable matches.");
  } else if (confidenceScore >= 50) {
    explanations.push("Moderate confidence in ARV estimate. Consider getting a professional appraisal.");
  } else {
    explanations.push("Low confidence in ARV estimate. Limited comparable data available.");
  }
  
  return explanations;
}

// Export default cost model for external reference
export const renovationCostModel = DEFAULT_RENOVATION_COST_MODEL;

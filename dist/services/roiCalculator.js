/**
 * ROI Calculator Service
 * Handles various investment scenario calculations
 */
/**
 * Calculate monthly mortgage payment
 */
export function calculateMonthlyMortgagePayment(loanAmount, interestRate, termYears) {
    const monthlyRate = interestRate / 100 / 12;
    const payments = termYears * 12;
    return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, payments)) / (Math.pow(1 + monthlyRate, payments) - 1);
}
/**
 * Calculate financing costs for a property
 */
export function calculateFinancingCosts(purchasePrice, financingDetails) {
    const { downPaymentPercent, interestRate, loanTermYears, loanPoints = 0, originationFeePercent = 1 } = financingDetails;
    // Calculate loan details
    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthlyPayment = calculateMonthlyMortgagePayment(loanAmount, interestRate, loanTermYears);
    // Calculate closing costs
    const pointsCost = loanAmount * (loanPoints / 100);
    const originationFee = loanAmount * (originationFeePercent / 100);
    const otherClosingCosts = purchasePrice * 0.02; // Estimate other closing costs at 2%
    const totalClosingCosts = pointsCost + originationFee + otherClosingCosts;
    // Calculate total financing cost over the life of the loan
    const totalFinancingCost = (monthlyPayment * loanTermYears * 12) - loanAmount;
    return {
        downPayment,
        loanAmount,
        monthlyPayment,
        closingCosts: totalClosingCosts,
        totalFinancingCost
    };
}
/**
 * Create different ROI scenarios for comparison
 */
export function createROIScenarios(baseData) {
    const { purchasePrice, renovationCost, projectedARV, zipCode } = baseData;
    // Base ROI calculation for cash purchase
    const cashScenario = {
        name: "All Cash Purchase",
        description: "Purchase property with 100% cash, no financing costs",
        purchasePrice,
        closingCosts: purchasePrice * 0.02,
        renovationCosts: renovationCost,
        holdingCosts: {
            monthly: purchasePrice * 0.005, // 0.5% monthly holding costs (taxes, insurance, utilities)
            total: purchasePrice * 0.005 * 6 // Assuming 6 months hold
        },
        projectedARV,
        sellingCosts: projectedARV * 0.08, // 8% selling costs (agent commission, closing, etc.)
        netProfit: calculateNetProfit(purchasePrice, renovationCost, projectedARV, 0),
        roi: calculateROIPercent(purchasePrice, renovationCost, projectedARV, 0),
        timelineImpact: {
            bestCase: 0, // Will be calculated
            expected: 0, // Will be calculated
            worstCase: 0 // Will be calculated
        },
        assumptions: [
            "100% cash purchase",
            "No financing costs",
            "6 month holding period",
            "8% selling costs"
        ],
        sensitivityAnalysis: {
            purchasePrice: {
                min: purchasePrice * 0.95,
                expected: purchasePrice,
                max: purchasePrice * 1.05
            },
            renovationCost: {
                min: renovationCost * 0.8,
                expected: renovationCost,
                max: renovationCost * 1.5
            },
            projectedARV: {
                min: projectedARV * 0.9,
                expected: projectedARV,
                max: projectedARV * 1.1
            },
            timeToSell: {
                min: 3,
                expected: 6,
                max: 12
            }
        }
    };
    // Calculate timeline impact
    cashScenario.timelineImpact = {
        bestCase: calculateROIPercent(cashScenario.sensitivityAnalysis.purchasePrice.min, cashScenario.sensitivityAnalysis.renovationCost.min, cashScenario.sensitivityAnalysis.projectedARV.max, cashScenario.sensitivityAnalysis.timeToSell.min),
        expected: cashScenario.roi,
        worstCase: calculateROIPercent(cashScenario.sensitivityAnalysis.purchasePrice.max, cashScenario.sensitivityAnalysis.renovationCost.max, cashScenario.sensitivityAnalysis.projectedARV.min, cashScenario.sensitivityAnalysis.timeToSell.max)
    };
    // Calculate conventional financing scenario (20% down)
    const conventionalScenario = calculateFinancingScenario({
        name: "Conventional Financing",
        description: "20% down payment with conventional mortgage",
        baseData,
        financing: {
            downPaymentPercent: 20,
            interestRate: 7.5,
            loanTermYears: 30,
            loanPoints: 1,
            originationFeePercent: 1
        },
        holdingPeriodMonths: 6,
        assumptions: [
            "20% down payment",
            "7.5% interest rate on 30-year loan",
            "1 point + 1% origination fee",
            "6 month holding period",
            "8% selling costs"
        ]
    });
    // Calculate hard money scenario (15% down)
    const hardMoneyScenario = calculateFinancingScenario({
        name: "Hard Money Loan",
        description: "15% down payment with hard money loan for rehab",
        baseData,
        financing: {
            downPaymentPercent: 15,
            interestRate: 12,
            loanTermYears: 1,
            loanPoints: 2,
            originationFeePercent: 2
        },
        holdingPeriodMonths: 6,
        assumptions: [
            "15% down payment",
            "12% interest rate on 1-year hard money loan",
            "2 points + 2% origination fee",
            "6 month holding period",
            "8% selling costs",
            "Interest-only payments during holding period"
        ]
    });
    return [cashScenario, conventionalScenario, hardMoneyScenario];
}
/**
 * Helper function to calculate a financing scenario
 */
function calculateFinancingScenario(options) {
    const { name, description, baseData, financing, holdingPeriodMonths, assumptions } = options;
    const { purchasePrice, renovationCost, projectedARV } = baseData;
    // Calculate financing costs
    const financingDetails = calculateFinancingCosts(purchasePrice, financing);
    // Calculate monthly holding costs (mortgage + other expenses)
    const otherMonthlyExpenses = purchasePrice * 0.002; // Property tax, insurance, utilities
    const monthlyHoldingCost = financingDetails.monthlyPayment + otherMonthlyExpenses;
    const totalHoldingCost = monthlyHoldingCost * holdingPeriodMonths;
    // Calculate total cash invested
    const totalCashInvested = financingDetails.downPayment + financingDetails.closingCosts + renovationCost + totalHoldingCost;
    // Calculate selling costs
    const sellingCosts = projectedARV * 0.08;
    // Calculate net proceeds after paying off loan
    const netProceeds = projectedARV - sellingCosts - financingDetails.loanAmount;
    // Calculate net profit
    const netProfit = netProceeds - (totalCashInvested - financingDetails.loanAmount);
    // Calculate ROI
    const roi = (netProfit / totalCashInvested) * 100;
    // Create the scenario
    const scenario = {
        name,
        description,
        purchasePrice,
        closingCosts: financingDetails.closingCosts,
        renovationCosts: renovationCost,
        holdingCosts: {
            monthly: monthlyHoldingCost,
            total: totalHoldingCost
        },
        projectedARV,
        sellingCosts,
        netProfit,
        roi,
        cashOnCashReturn: roi, // Same as ROI for this calculation
        timelineImpact: {
            bestCase: 0, // Will be calculated
            expected: roi,
            worstCase: 0 // Will be calculated
        },
        assumptions,
        sensitivityAnalysis: {
            purchasePrice: {
                min: purchasePrice * 0.95,
                expected: purchasePrice,
                max: purchasePrice * 1.05
            },
            renovationCost: {
                min: renovationCost * 0.8,
                expected: renovationCost,
                max: renovationCost * 1.5
            },
            projectedARV: {
                min: projectedARV * 0.9,
                expected: projectedARV,
                max: projectedARV * 1.1
            },
            timeToSell: {
                min: Math.max(1, holdingPeriodMonths - 3),
                expected: holdingPeriodMonths,
                max: holdingPeriodMonths * 2
            }
        }
    };
    // Calculate best and worst case ROI based on sensitivity analysis
    // Note: This is a simplification - a real implementation would be more sophisticated
    const bestCaseNetProfit = (scenario.sensitivityAnalysis.projectedARV.max - scenario.sensitivityAnalysis.purchasePrice.min) * 0.92 - scenario.sensitivityAnalysis.renovationCost.min;
    const worstCaseNetProfit = (scenario.sensitivityAnalysis.projectedARV.min - scenario.sensitivityAnalysis.purchasePrice.max) * 0.92 - scenario.sensitivityAnalysis.renovationCost.max;
    scenario.timelineImpact = {
        bestCase: (bestCaseNetProfit / totalCashInvested) * 100,
        expected: roi,
        worstCase: (worstCaseNetProfit / totalCashInvested) * 100
    };
    return scenario;
}
/**
 * Helper function to calculate net profit
 */
function calculateNetProfit(purchasePrice, renovationCost, projectedARV, holdingMonths) {
    const closingCosts = purchasePrice * 0.02;
    const monthlyHolding = purchasePrice * 0.005;
    const totalHoldingCosts = monthlyHolding * (holdingMonths || 6);
    const sellingCosts = projectedARV * 0.08;
    const totalInvestment = purchasePrice + closingCosts + renovationCost + totalHoldingCosts;
    const netProceeds = projectedARV - sellingCosts;
    return netProceeds - totalInvestment;
}
/**
 * Helper function to calculate ROI percentage
 */
function calculateROIPercent(purchasePrice, renovationCost, projectedARV, holdingMonths) {
    const netProfit = calculateNetProfit(purchasePrice, renovationCost, projectedARV, holdingMonths);
    const closingCosts = purchasePrice * 0.02;
    const monthlyHolding = purchasePrice * 0.005;
    const totalHoldingCosts = monthlyHolding * (holdingMonths || 6);
    const totalInvestment = purchasePrice + closingCosts + renovationCost + totalHoldingCosts;
    return (netProfit / totalInvestment) * 100;
}
/**
 * Calculate after repair value based on property data and renovation scope
 */
export function estimateARV(propertyData, renovationData) {
    // This is a simplified ARV calculator
    // In a real application, this would use comp data and more sophisticated algorithms
    const { purchasePrice, squareFootage } = propertyData;
    const { kitchen = false, bathrooms = false, flooring = false, paint = false, exterior = false, landscaping = false, structural = false } = renovationData;
    // Base ARV is 20% over purchase price
    let arvMultiplier = 1.2;
    // Adjust for renovations
    if (kitchen)
        arvMultiplier += 0.05;
    if (bathrooms)
        arvMultiplier += 0.05;
    if (flooring)
        arvMultiplier += 0.03;
    if (paint)
        arvMultiplier += 0.02;
    if (exterior)
        arvMultiplier += 0.04;
    if (landscaping)
        arvMultiplier += 0.02;
    if (structural)
        arvMultiplier += 0.05;
    // Simple ARV calculation
    return purchasePrice * arvMultiplier;
}
//# sourceMappingURL=roiCalculator.js.map
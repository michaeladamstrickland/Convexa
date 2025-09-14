/**
 * Utility functions for formatting data in the FlipTracker application
 */

/**
 * Format a number as currency
 * @param {number} value - Number to format as currency
 * @param {string} locale - Locale to use for formatting (default: en-US)
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, locale = 'en-US', currency = 'USD') => {
  if (value === undefined || value === null) return 'N/A';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Format a date string or timestamp
 * @param {string|number} date - Date string or timestamp
 * @param {string} locale - Locale to use for formatting (default: en-US)
 * @returns {string} Formatted date string
 */
export const formatDate = (date, locale = 'en-US') => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    
    // Check if valid date
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    return dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Error';
  }
};

/**
 * Calculate monthly mortgage payment
 * @param {number} principal - Loan amount
 * @param {number} interestRate - Annual interest rate as percentage (e.g., 4.5)
 * @param {number} years - Loan term in years
 * @returns {number} Monthly payment amount
 */
export const calculateMortgage = (principal, interestRate, years) => {
  if (!principal || !interestRate || !years) return null;
  
  const monthlyRate = interestRate / 100 / 12;
  const numberOfPayments = years * 12;
  
  if (monthlyRate === 0) return principal / numberOfPayments;
  
  const monthlyPayment = principal * 
    (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
    (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
  return monthlyPayment;
};

/**
 * Format a number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number with commas
 */
export const formatNumber = (num) => {
  if (num === undefined || num === null) return 'N/A';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * Calculate the years since a given date
 * @param {string|number} date - Date string or timestamp
 * @returns {number} Number of years since the date, or null if invalid
 */
export const yearsSince = (date) => {
  if (!date) return null;
  
  try {
    const dateObj = new Date(date);
    
    // Check if valid date
    if (isNaN(dateObj.getTime())) return null;
    
    const differenceMs = Date.now() - dateObj.getTime();
    const years = differenceMs / (1000 * 60 * 60 * 24 * 365.25);
    
    return Math.floor(years);
  } catch (error) {
    console.error('Error calculating years since date:', error);
    return null;
  }
};

/**
 * Calculate the appreciation rate between two values over a period of years
 * @param {number} startValue - Initial value
 * @param {number} endValue - Final value
 * @param {number} years - Number of years between values
 * @returns {number} Annual appreciation rate as percentage, or null if invalid
 */
export const calculateAppreciationRate = (startValue, endValue, years) => {
  if (!startValue || !endValue || !years || years <= 0) return null;
  
  // Calculate compound annual growth rate
  const rate = Math.pow(endValue / startValue, 1 / years) - 1;
  
  // Convert to percentage
  return rate * 100;
};

/**
 * Calculate the cap rate (NOI / Property Value)
 * @param {number} noi - Net Operating Income (annual)
 * @param {number} propertyValue - Property value
 * @returns {number} Cap rate as percentage, or null if invalid
 */
export const calculateCapRate = (noi, propertyValue) => {
  if (!noi || !propertyValue) return null;
  
  return (noi / propertyValue) * 100;
};

/**
 * Calculate cash on cash return
 * @param {number} annualCashFlow - Annual cash flow after expenses and debt service
 * @param {number} initialInvestment - Initial investment (typically down payment + closing costs)
 * @returns {number} Cash on cash return as percentage, or null if invalid
 */
export const calculateCashOnCash = (annualCashFlow, initialInvestment) => {
  if (!annualCashFlow || !initialInvestment) return null;
  
  return (annualCashFlow / initialInvestment) * 100;
};

/**
 * Calculate after repair value
 * @param {number} currentValue - Current property value
 * @param {number} rehabCostPerSqFt - Rehab cost per square foot
 * @param {number} squareFeet - Property square footage
 * @returns {number} Estimated ARV, or null if invalid
 */
export const calculateARV = (currentValue, rehabCostPerSqFt, squareFeet) => {
  if (!currentValue || !squareFeet) return null;
  
  // Default rehab cost per square foot if not provided
  const rehabCost = rehabCostPerSqFt ? rehabCostPerSqFt * squareFeet : currentValue * 0.1;
  
  return currentValue + rehabCost;
};

/**
 * Format a percentage
 * @param {number} value - Percentage value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === undefined || value === null) return 'N/A';
  
  return value.toFixed(decimals) + '%';
};

/**
 * Format square footage
 * @param {number} value - Square footage value
 * @returns {string} Formatted square footage string
 */
export const formatSqFt = (value) => {
  if (value === undefined || value === null) return 'N/A';
  
  return formatNumber(value) + ' sq ft';
};

/**
 * Estimate monthly rent based on property value
 * @param {number} propertyValue - Property value
 * @param {number} rentRatio - Monthly rent as percentage of property value (default: 0.8%)
 * @returns {number} Estimated monthly rent
 */
export const estimateRent = (propertyValue, rentRatio = 0.008) => {
  if (!propertyValue) return null;
  
  return propertyValue * rentRatio;
};

/**
 * Calculate potential ROI for a fix and flip deal
 * @param {number} arv - After Repair Value
 * @param {number} purchasePrice - Purchase price
 * @param {number} rehabCosts - Rehabilitation costs
 * @param {number} holdingCosts - Holding costs
 * @param {number} sellingCosts - Selling costs (default: 6% of ARV)
 * @returns {object} ROI metrics: profit, roi, and cashOnCash
 */
export const calculateFlipROI = (arv, purchasePrice, rehabCosts, holdingCosts, sellingCosts = arv * 0.06) => {
  if (!arv || !purchasePrice) return { profit: null, roi: null };
  
  // Default values
  rehabCosts = rehabCosts || 0;
  holdingCosts = holdingCosts || 0;
  sellingCosts = sellingCosts || arv * 0.06;
  
  const totalCosts = purchasePrice + rehabCosts + holdingCosts + sellingCosts;
  const profit = arv - totalCosts;
  const roi = (profit / totalCosts) * 100;
  
  return { 
    profit,
    roi,
    totalCosts
  };
};

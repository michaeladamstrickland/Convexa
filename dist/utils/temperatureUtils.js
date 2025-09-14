"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapScoreToTemperature = mapScoreToTemperature;
exports.calculateHeuristicScore = calculateHeuristicScore;
/**
 * Maps an AI score to a temperature tag
 *
 * @param score The AI score to map (0-100)
 * @returns Temperature tag: 'DEAD' | 'WARM' | 'HOT' | 'ON_FIRE'
 */
function mapScoreToTemperature(score) {
    if (score < 40) {
        return 'DEAD';
    }
    else if (score < 65) {
        return 'WARM';
    }
    else if (score < 80) {
        return 'HOT';
    }
    else {
        return 'ON_FIRE';
    }
}
/**
 * Calculate an AI score based on lead properties when OpenAI is not available
 * This is a heuristic fallback implementation
 *
 * @param lead Lead properties for score calculation
 * @returns Score from 0-100
 */
function calculateHeuristicScore(lead) {
    let score = 0;
    // Base score from motivation_score (if available)
    if (lead.motivation_score !== undefined) {
        score = lead.motivation_score;
    }
    else {
        // Start with a base score of 50 if no motivation score
        score = 50;
    }
    // Adjust based on equity percentage
    if (lead.equity !== undefined && lead.estimated_value && lead.estimated_value > 0) {
        const equityPercentage = (lead.equity / lead.estimated_value) * 100;
        // High equity is good
        if (equityPercentage >= 50) {
            score += 15;
        }
        else if (equityPercentage >= 30) {
            score += 10;
        }
        else if (equityPercentage >= 20) {
            score += 5;
        }
    }
    // Adjust for distress indicators
    if (lead.is_probate) {
        score += 15; // Probate is a strong motivation indicator
    }
    if (lead.is_vacant) {
        score += 10; // Vacant properties often indicate motivation
    }
    if (lead.tax_debt && lead.tax_debt > 0) {
        score += Math.min(10, lead.tax_debt / 1000); // 1 point per $1000 of tax debt, max 10
    }
    if (lead.violations && lead.violations > 0) {
        score += Math.min(10, lead.violations * 3); // 3 points per violation, max 10
    }
    if (lead.days_on_market) {
        // Long time on market increases motivation
        if (lead.days_on_market > 180) {
            score += 10;
        }
        else if (lead.days_on_market > 90) {
            score += 5;
        }
    }
    // Ensure score is within bounds
    return Math.max(0, Math.min(100, score));
}
//# sourceMappingURL=temperatureUtils.js.map
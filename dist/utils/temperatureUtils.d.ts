/**
 * Maps an AI score to a temperature tag
 *
 * @param score The AI score to map (0-100)
 * @returns Temperature tag: 'DEAD' | 'WARM' | 'HOT' | 'ON_FIRE'
 */
export declare function mapScoreToTemperature(score: number): 'DEAD' | 'WARM' | 'HOT' | 'ON_FIRE';
/**
 * Calculate an AI score based on lead properties when OpenAI is not available
 * This is a heuristic fallback implementation
 *
 * @param lead Lead properties for score calculation
 * @returns Score from 0-100
 */
export declare function calculateHeuristicScore(lead: {
    motivation_score?: number;
    equity?: number;
    estimated_value?: number;
    is_probate?: boolean;
    is_vacant?: boolean;
    tax_debt?: number;
    violations?: number;
    days_on_market?: number;
}): number;
//# sourceMappingURL=temperatureUtils.d.ts.map
export interface ScoreInput {
    price?: number | null;
    sqft?: number | null;
    condition?: string | null;
}
export interface ScoreResult {
    score: number;
    tags: string[];
    condition: string;
    reasons?: string[];
    tagReasons?: Array<{
        tag: string;
        reason: string;
    }>;
}
export declare function computeScoreAndTags(input: ScoreInput): ScoreResult;
//# sourceMappingURL=scoring.d.ts.map
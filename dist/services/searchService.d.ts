export interface SearchParams {
    query?: string;
    minValue?: number;
    maxValue?: number;
    city?: string;
    state?: string;
    zipCode?: string;
    propertyType?: string;
    source?: string;
    temperature?: string;
    status?: string;
    limit?: number;
    page?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export declare class SearchService {
    /**
     * Search for leads with various filters
     */
    searchLeads(params: SearchParams): Promise<{}>;
    /**
     * Get lead analytics and metrics
     */
    getLeadAnalytics(): Promise<{}>;
    /**
     * Clear search cache
     */
    clearCache(): {
        success: boolean;
        message: string;
    };
    /**
     * Format lead for API response
     */
    private formatLead;
}
declare const _default: SearchService;
export default _default;
//# sourceMappingURL=searchService.d.ts.map
import type { AxiosInstance } from "axios";
export declare function getAttomClient(): Promise<AxiosInstance | null>;
/**
 * Search for properties by ZIP code
 *
 * @param zipCode - ZIP code to search
 * @param pageSize - Number of results to return (default: 10)
 * @returns Array of property data or empty array if feature disabled
 */
export declare function searchByZip(zipCode: string, pageSize?: number): Promise<{
    properties: any;
    status: string;
    message?: undefined;
} | {
    properties: never[];
    status: string;
    message: any;
}>;
/**
 * Get property details by address
 *
 * @param address - Street address
 * @param city - City name
 * @param state - State code
 * @param zip - ZIP code
 * @returns Property details or null if not found or disabled
 */
export declare function getPropertyByAddress(address: string, city: string, state: string, zip: string): Promise<{
    property: any;
    status: string;
    message?: undefined;
} | {
    property: null;
    status: string;
    message: any;
}>;
/**
 * Get property details by ATTOM ID
 *
 * @param attomId - ATTOM property ID
 * @returns Property details or null if not found or disabled
 */
export declare function getPropertyById(attomId: string): Promise<{
    property: any;
    status: string;
    message?: undefined;
} | {
    property: null;
    status: string;
    message: any;
}>;
/**
 * Check if ATTOM API is available and working
 *
 * @returns Status of the ATTOM API
 */
export declare function checkHealth(): Promise<{
    service: string;
    enabled: boolean;
    status: string;
    message: string;
    latency?: undefined;
    statusCode?: undefined;
} | {
    service: string;
    enabled: boolean;
    status: string;
    latency: number;
    message?: undefined;
    statusCode?: undefined;
} | {
    service: string;
    enabled: boolean;
    status: string;
    message: any;
    statusCode: any;
    latency: number;
}>;
declare const _default: {
    searchByZip: typeof searchByZip;
    getPropertyByAddress: typeof getPropertyByAddress;
    getPropertyById: typeof getPropertyById;
    checkHealth: typeof checkHealth;
};
export default _default;
//# sourceMappingURL=attomService.d.ts.map
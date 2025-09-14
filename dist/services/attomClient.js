"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttomClient = void 0;
const dotenv = __importStar(require("dotenv"));
const addressNormalization_1 = require("../utils/addressNormalization");
const vendorClient_1 = require("../utils/vendorClient");
dotenv.config();
/**
 * ATTOM API Property Data Client
 *
 * This service handles communication with the ATTOM API for property data lookups
 * and integrates with our Lead model for data storage.
 */
class AttomClient {
    constructor() {
        this.maxRetries = 3;
        this.costPerLookupCents = 5; // Update with actual cost
        this.cache = new Map();
        // Track daily API usage
        this.dailySpendCents = 0;
        this.lastResetDay = new Date().getDate();
        this.apiKey = process.env.ATTOM_API_KEY || '';
        this.dailyCap = parseInt(process.env.DAILY_CAP_ATTOM_CENTS || '1000', 10);
        this.cacheTtlSeconds = parseInt(process.env.CACHE_TTL_SECONDS || '900', 10);
        if (!this.apiKey) {
            throw new Error('ATTOM API key not found in environment variables');
        }
        this.client = (0, vendorClient_1.makeClient)('https://api.gateway.attomdata.com/propertyapi/v1', {
            'apiKey': this.apiKey,
            'Accept': 'application/json'
        });
        // Reset the daily spend counter if it's a new day
        this.checkDailyReset();
    }
    /**
     * Search for properties by address
     *
     * @param address Street address
     * @param city City name
     * @param state State code (2 letter)
     * @param zip ZIP code
     * @returns Property details or null if not found
     */
    async getPropertyByAddress(address, city, state, zip) {
        const normalizedAddress = (0, addressNormalization_1.normalizeAddress)(`${address}, ${city}, ${state} ${zip}`);
        const cacheKey = `address:${normalizedAddress}`;
        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log(`Cache hit for address: ${normalizedAddress}`);
            return cached;
        }
        // Check daily cap
        this.checkDailyReset();
        if (this.dailySpendCents + this.costPerLookupCents > this.dailyCap) {
            const error = new Error('Daily ATTOM API cap exceeded');
            error.status = 429;
            throw error;
        }
        try {
            // Make the API request with retries
            const response = await this.makeRequestWithRetry('property/address', {
                params: {
                    address1: address,
                    address2: `${city}, ${state} ${zip}`
                }
            });
            if (!response?.data?.property || response.data.property.length === 0) {
                console.log(`No property found for address: ${address}, ${city}, ${state} ${zip}`);
                return null;
            }
            const property = response.data.property[0];
            // Track the API usage cost
            await this.trackApiUsage('property/address');
            // Map the ATTOM data to our Lead model
            const result = this.mapPropertyToLead(property, normalizedAddress);
            // Cache the result
            this.addToCache(cacheKey, result);
            return result;
        }
        catch (error) {
            this.handleError(error, `Error fetching property by address: ${address}`);
            return null;
        }
    }
    /**
     * Search for properties by ZIP code
     *
     * @param zipCode ZIP code to search
     * @param limit Maximum number of results to return
     * @returns Array of property details
     */
    async getPropertiesByZipCode(zipCode, limit = 10) {
        const cacheKey = `zip:${zipCode}:${limit}`;
        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log(`Cache hit for ZIP code: ${zipCode}`);
            return cached;
        }
        // Check daily cap
        this.checkDailyReset();
        if (this.dailySpendCents + this.costPerLookupCents > this.dailyCap) {
            const error = new Error('Daily ATTOM API cap exceeded');
            error.status = 429;
            throw error;
        }
        try {
            const response = await this.makeRequestWithRetry('property/address', {
                params: {
                    postalcode: zipCode,
                    page: 1,
                    pagesize: limit
                }
            });
            if (!response?.data?.property || response.data.property.length === 0) {
                console.log(`No properties found for ZIP code: ${zipCode}`);
                return [];
            }
            // Track the API usage cost
            await this.trackApiUsage('property/address');
            // Map each property to our Lead model
            const properties = response.data.property;
            const leads = [];
            for (const property of properties) {
                // Extract address components
                const propertyAddress = property.address?.line1 || '';
                const city = property.address?.locality || '';
                const state = property.address?.countrySubd || '';
                const zip = property.address?.postal1 || '';
                const normalizedAddress = (0, addressNormalization_1.normalizeAddress)(`${propertyAddress}, ${city}, ${state} ${zip}`);
                // Map to lead
                const lead = this.mapPropertyToLead(property, normalizedAddress);
                leads.push(lead);
            }
            // Cache the results
            this.addToCache(cacheKey, leads);
            return leads;
        }
        catch (error) {
            this.handleError(error, `Error fetching properties by ZIP code: ${zipCode}`);
            return [];
        }
    }
    /**
     * Get property details by ATTOM ID
     *
     * @param attomId ATTOM Property ID
     * @returns Property details or null if not found
     */
    async getPropertyById(attomId) {
        const cacheKey = `attomid:${attomId}`;
        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log(`Cache hit for ATTOM ID: ${attomId}`);
            return cached;
        }
        // Check daily cap
        this.checkDailyReset();
        if (this.dailySpendCents + this.costPerLookupCents > this.dailyCap) {
            const error = new Error('Daily ATTOM API cap exceeded');
            error.status = 429;
            throw error;
        }
        try {
            const response = await this.makeRequestWithRetry('property/basicprofile', {
                params: {
                    attomid: attomId
                }
            });
            if (!response?.data?.property || response.data.property.length === 0) {
                console.log(`No property found for ATTOM ID: ${attomId}`);
                return null;
            }
            const property = response.data.property[0];
            // Track the API usage cost
            await this.trackApiUsage('property/basicprofile');
            // Get address components
            const address = property.address?.line1 || '';
            const city = property.address?.locality || '';
            const state = property.address?.countrySubd || '';
            const zip = property.address?.postal1 || '';
            const normalizedAddress = (0, addressNormalization_1.normalizeAddress)(`${address}, ${city}, ${state} ${zip}`);
            // Map the ATTOM data to our Lead model
            const result = this.mapPropertyToLead(property, normalizedAddress);
            // Cache the result
            this.addToCache(cacheKey, result);
            return result;
        }
        catch (error) {
            this.handleError(error, `Error fetching property by ATTOM ID: ${attomId}`);
            return null;
        }
    }
    /**
     * Convert ATTOM property data to our Lead model
     */
    mapPropertyToLead(property, normalizedAddress) {
        // Extract address components
        const address = property.address?.line1 || '';
        const city = property.address?.locality || '';
        const state = property.address?.countrySubd || '';
        const zip = property.address?.postal1 || '';
        // Extract property details
        const bedrooms = property.building?.rooms?.beds || null;
        const bathrooms = property.building?.rooms?.bathstotal || null;
        const squareFootage = property.building?.size?.universalsize || null;
        const lotSize = property.lot?.lotsize1 || null;
        const yearBuilt = property.summary?.yearbuilt || null;
        // Extract valuation data
        const marketValue = property.assessment?.market?.mktttlvalue || null;
        const taxAssessedValue = property.assessment?.assessed?.assdttlvalue || null;
        // Extract last sale data
        const lastSalePrice = property.sale?.amount?.saleamt || null;
        const lastSaleDate = property.sale?.salesearchdate ? new Date(property.sale.salesearchdate) : null;
        // Check if property is likely absentee owned
        const ownerOccupied = property.summary?.propclass === 'SFR' && property.summary?.propsubtype === 'SINGLE FAMILY RESIDENCE - OWNER OCCUPIED';
        const isAbsenteeOwner = !ownerOccupied;
        // Determine property type
        let propertyType = 'unknown';
        if (property.summary?.proptype === 'SFR')
            propertyType = 'single_family';
        else if (property.summary?.proptype === 'CONDO')
            propertyType = 'condo';
        else if (property.summary?.proptype === 'MULTI-FAMILY DWELLING')
            propertyType = 'multi_family';
        else if (property.summary?.proptype === 'TOWNHOUSE')
            propertyType = 'townhouse';
        // Calculate estimated equity
        let equity = null;
        let equityPercent = null;
        if (marketValue && lastSalePrice) {
            equity = marketValue - lastSalePrice;
            equityPercent = (equity / marketValue) * 100;
        }
        // Return the formatted lead data
        return {
            source: 'attom:property-detail',
            propertyAddress: address,
            city,
            state,
            zipCode: zip,
            normalizedAddress,
            propertyType,
            bedrooms,
            bathrooms,
            squareFootage,
            lotSize,
            yearBuilt,
            marketValue,
            taxAssessedValue,
            lastSalePrice,
            lastSaleDate,
            isAbsenteeOwner,
            equity,
            equityPercent,
            estimatedValue: marketValue,
        };
    }
    /**
     * Track API usage for cost reporting
     */
    async trackApiUsage(endpoint) {
        try {
            this.dailySpendCents += this.costPerLookupCents;
            console.log(`ATTOM API call to ${endpoint} - Cost: ${this.costPerLookupCents} cents, Daily total: ${this.dailySpendCents} cents`);
            // TODO: Implement database cost tracking if needed
        }
        catch (error) {
            console.error('Error tracking API usage:', error);
        }
    }
    /**
     * Make API request with automatic retry logic
     */
    async makeRequestWithRetry(endpoint, config) {
        const startTime = Date.now();
        try {
            const response = await (0, vendorClient_1.retryWithBackoff)(() => this.client.get(endpoint, config), this.maxRetries, 250, this.isRetryableError);
            (0, vendorClient_1.logApiCall)('ATTOM', endpoint, response.status, startTime);
            return response;
        }
        catch (error) {
            const axiosError = error;
            (0, vendorClient_1.logApiCall)('ATTOM', endpoint, axiosError.response?.status || 0, startTime, axiosError);
            throw error;
        }
    }
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        if (!error.response)
            return true;
        const status = error.response.status;
        return status === 429 || status >= 500;
    }
    /**
     * Handle API errors
     */
    handleError(error, message) {
        const axiosError = error;
        const status = axiosError.response?.status;
        const errorData = axiosError.response?.data;
        console.error(`${message}: ${error.message}`);
        if (status) {
            console.error(`Status: ${status}`);
        }
        if (errorData) {
            console.error('Error details:', errorData);
        }
    }
    /**
     * Check and reset daily counter if necessary
     */
    checkDailyReset() {
        const currentDay = new Date().getDate();
        if (currentDay !== this.lastResetDay) {
            console.log('Resetting ATTOM API daily spend counter');
            this.dailySpendCents = 0;
            this.lastResetDay = currentDay;
        }
    }
    /**
     * Add item to cache
     */
    addToCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    /**
     * Get item from cache, return null if expired
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        const ageMs = Date.now() - cached.timestamp;
        if (ageMs > this.cacheTtlSeconds * 1000) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }
    /**
     * Check API health
     */
    async checkHealth() {
        try {
            const startTime = Date.now();
            const response = await this.client.get('property/basicprofile', {
                params: {
                    attomid: '1234567'
                }
            });
            return {
                healthy: true,
                latency: Date.now() - startTime,
                status: response.status
            };
        }
        catch (error) {
            return {
                healthy: false,
                error: error.message,
                status: error.response?.status
            };
        }
    }
}
exports.AttomClient = AttomClient;
exports.default = new AttomClient();
//# sourceMappingURL=attomClient.js.map
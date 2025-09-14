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
exports.searchByZip = searchByZip;
exports.getPropertyByAddress = getPropertyByAddress;
exports.getPropertyById = getPropertyById;
exports.checkHealth = checkHealth;
const dotenv = __importStar(require("dotenv"));
const vendorClient_1 = require("../utils/vendorClient");
dotenv.config();
// Check if ATTOM integration is enabled
const isAttomEnabled = process.env.FEATURE_ATTOM_ENABLED === 'true';
// Create ATTOM API client
const attomBaseUrl = process.env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com';
const attomApiKey = process.env.ATTOM_API_KEY || '';
// Only create the client if ATTOM is enabled and API key is provided
const attom = isAttomEnabled && attomApiKey
    ? (0, vendorClient_1.makeClient)(attomBaseUrl, { apikey: attomApiKey })
    : null;
/**
 * Search for properties by ZIP code
 *
 * @param zipCode - ZIP code to search
 * @param pageSize - Number of results to return (default: 10)
 * @returns Array of property data or empty array if feature disabled
 */
async function searchByZip(zipCode, pageSize = 10) {
    // If ATTOM is disabled or client wasn't initialized, return empty results
    if (!isAttomEnabled || !attom) {
        console.warn('ATTOM API is disabled. Returning empty results.');
        return { properties: [], status: 'disabled' };
    }
    const startTime = Date.now();
    const endpoint = `/propertyapi/v1.0.0/property/address`;
    try {
        const { data, status } = await attom.get(endpoint, {
            params: {
                postalcode: encodeURIComponent(zipCode),
                page: 1,
                pagesize: pageSize
            }
        });
        // Log the successful API call
        (0, vendorClient_1.logApiCall)('ATTOM', `${endpoint} (ZIP: ${zipCode})`, status, startTime);
        return {
            properties: data.property || [],
            status: 'success'
        };
    }
    catch (error) {
        // Log the failed API call
        (0, vendorClient_1.logApiCall)('ATTOM', `${endpoint} (ZIP: ${zipCode})`, error.response?.status || 0, startTime, error);
        // Return empty results with an error status
        return {
            properties: [],
            status: 'error',
            message: error.message
        };
    }
}
/**
 * Get property details by address
 *
 * @param address - Street address
 * @param city - City name
 * @param state - State code
 * @param zip - ZIP code
 * @returns Property details or null if not found or disabled
 */
async function getPropertyByAddress(address, city, state, zip) {
    // If ATTOM is disabled or client wasn't initialized, return null
    if (!isAttomEnabled || !attom) {
        console.warn('ATTOM API is disabled. Returning null.');
        return { property: null, status: 'disabled' };
    }
    const startTime = Date.now();
    const endpoint = `/propertyapi/v1.0.0/property/address`;
    try {
        const { data, status } = await attom.get(endpoint, {
            params: {
                address1: encodeURIComponent(address),
                address2: `${encodeURIComponent(city)}, ${state} ${zip}`
            }
        });
        // Log the successful API call
        (0, vendorClient_1.logApiCall)('ATTOM', `${endpoint} (Address: ${address})`, status, startTime);
        // Get the first property from results
        const property = data.property?.[0] || null;
        return {
            property,
            status: 'success'
        };
    }
    catch (error) {
        // Log the failed API call
        (0, vendorClient_1.logApiCall)('ATTOM', `${endpoint} (Address: ${address})`, error.response?.status || 0, startTime, error);
        // Return null with an error status
        return {
            property: null,
            status: 'error',
            message: error.message
        };
    }
}
/**
 * Get property details by ATTOM ID
 *
 * @param attomId - ATTOM property ID
 * @returns Property details or null if not found or disabled
 */
async function getPropertyById(attomId) {
    // If ATTOM is disabled or client wasn't initialized, return null
    if (!isAttomEnabled || !attom) {
        console.warn('ATTOM API is disabled. Returning null.');
        return { property: null, status: 'disabled' };
    }
    const startTime = Date.now();
    const endpoint = `/propertyapi/v1.0.0/property/basicprofile`;
    try {
        const { data, status } = await attom.get(endpoint, {
            params: {
                attomid: attomId
            }
        });
        // Log the successful API call
        (0, vendorClient_1.logApiCall)('ATTOM', `${endpoint} (ID: ${attomId})`, status, startTime);
        // Get the first property from results
        const property = data.property?.[0] || null;
        return {
            property,
            status: 'success'
        };
    }
    catch (error) {
        // Log the failed API call
        (0, vendorClient_1.logApiCall)('ATTOM', `${endpoint} (ID: ${attomId})`, error.response?.status || 0, startTime, error);
        // Return null with an error status
        return {
            property: null,
            status: 'error',
            message: error.message
        };
    }
}
/**
 * Check if ATTOM API is available and working
 *
 * @returns Status of the ATTOM API
 */
async function checkHealth() {
    // If ATTOM is disabled or client wasn't initialized, return disabled status
    if (!isAttomEnabled || !attom) {
        return {
            service: 'ATTOM API',
            enabled: false,
            status: 'disabled',
            message: 'ATTOM API is disabled in configuration.'
        };
    }
    const startTime = Date.now();
    const endpoint = `/propertyapi/v1.0.0/property/basicprofile`;
    try {
        // Try a basic endpoint with a dummy ID
        const { status } = await attom.get(endpoint, {
            params: {
                attomid: '1234567'
            }
        });
        // Log the health check
        (0, vendorClient_1.logApiCall)('ATTOM', `${endpoint} (Health Check)`, status, startTime);
        return {
            service: 'ATTOM API',
            enabled: true,
            status: 'healthy',
            latency: Date.now() - startTime
        };
    }
    catch (error) {
        // Log the health check failure
        (0, vendorClient_1.logApiCall)('ATTOM', `${endpoint} (Health Check)`, error.response?.status || 0, startTime, error);
        return {
            service: 'ATTOM API',
            enabled: true,
            status: 'unhealthy',
            message: error.message,
            statusCode: error.response?.status,
            latency: Date.now() - startTime
        };
    }
}
exports.default = {
    searchByZip,
    getPropertyByAddress,
    getPropertyById,
    checkHealth
};
//# sourceMappingURL=attomService.js.map
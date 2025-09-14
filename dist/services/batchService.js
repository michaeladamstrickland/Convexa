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
exports.skipTraceByAddress = skipTraceByAddress;
exports.processSkipTraceResults = processSkipTraceResults;
exports.checkHealth = checkHealth;
const dotenv = __importStar(require("dotenv"));
const vendorClient_1 = require("../utils/vendorClient");
dotenv.config();
// Check if BatchData integration is enabled
const isBatchEnabled = process.env.FEATURE_BATCH_ENABLED !== 'false';
// Create BatchData API client
const batchBaseUrl = process.env.BATCHDATA_BASE_URL || 'https://api.batchdata.com/v1';
const batchApiKey = process.env.BATCHDATA_API_KEY || '';
// Only create the client if BatchData is enabled and API key is provided
const batch = isBatchEnabled && batchApiKey
    ? (0, vendorClient_1.makeClient)(batchBaseUrl, {
        'X-API-Key': batchApiKey,
        'Content-Type': 'application/json'
    })
    : null;
// Track daily API usage
let dailySpendCents = 0;
let lastResetDay = new Date().getDate();
// Set daily spending cap
const dailyCap = parseInt(process.env.DAILY_CAP_BATCH_CENTS || '1000', 10);
const costPerLookupCents = 10; // Adjust based on BatchData's pricing
/**
 * Check and reset daily counter if necessary
 */
function checkDailyReset() {
    const currentDay = new Date().getDate();
    if (currentDay !== lastResetDay) {
        console.log('Resetting BatchData daily spend counter');
        dailySpendCents = 0;
        lastResetDay = currentDay;
    }
}
/**
 * Track API usage and cost
 */
function trackApiUsage(endpoint) {
    checkDailyReset();
    dailySpendCents += costPerLookupCents;
    console.log(`BatchData API call cost: ${costPerLookupCents}¢, daily total: ${dailySpendCents}¢`);
}
/**
 * Skip trace a property owner by address
 *
 * @param address - Property street address
 * @param city - City name
 * @param state - State code
 * @param zipCode - ZIP code
 * @param firstName - Optional owner first name for better matching
 * @param lastName - Optional owner last name for better matching
 * @returns Skip trace results or empty object if feature disabled
 */
async function skipTraceByAddress(address, city, state, zipCode, firstName, lastName) {
    // Check if BatchData API is enabled
    if (!isBatchEnabled || !batch) {
        console.warn('BatchData API is disabled. Returning empty results.');
        return { result: null, status: 'disabled' };
    }
    // Check daily cap
    checkDailyReset();
    if (dailySpendCents + costPerLookupCents > dailyCap) {
        const error = new Error('Daily BatchData API cap exceeded');
        error.status = 429;
        error.cap = dailyCap;
        error.spent = dailySpendCents;
        return {
            result: null,
            status: 'cap_exceeded',
            message: `Daily API cap of ${dailyCap}¢ exceeded (${dailySpendCents}¢)`
        };
    }
    const startTime = Date.now();
    const endpoint = '/property/skip';
    try {
        // Prepare the request payload
        const payload = {
            address,
            city,
            state,
            zip: zipCode,
            ...(firstName ? { first_name: firstName } : {}),
            ...(lastName ? { last_name: lastName } : {})
        };
        // Make the API request
        const { data, status } = await batch.post(endpoint, payload);
        // Track API usage
        trackApiUsage(endpoint);
        // Log the successful API call
        (0, vendorClient_1.logApiCall)('BatchData', `${endpoint} (Address: ${address})`, status, startTime);
        return {
            result: data.result || null,
            status: 'success',
            cost: costPerLookupCents / 100 // Convert to dollars for frontend
        };
    }
    catch (error) {
        // Log the failed API call
        (0, vendorClient_1.logApiCall)('BatchData', `${endpoint} (Address: ${address})`, error.response?.status || 0, startTime, error);
        // Return empty results with an error status
        return {
            result: null,
            status: 'error',
            message: error.message
        };
    }
}
/**
 * Process skip trace results to extract contact information
 *
 * @param skipTraceResult - Raw skip trace API result
 * @returns Formatted contact data
 */
function processSkipTraceResults(skipTraceResult) {
    if (!skipTraceResult || !skipTraceResult.result) {
        return {
            phones: [],
            emails: [],
            confidence: 0
        };
    }
    const result = skipTraceResult.result;
    // Extract phone numbers
    const phones = [];
    if (result.phones && Array.isArray(result.phones)) {
        for (const phone of result.phones) {
            phones.push({
                number: phone.phone_number,
                type: phone.line_type || 'unknown',
                status: phone.status || 'unknown',
                isConnected: phone.connected === true,
                isMobile: phone.line_type === 'mobile',
                isPrimary: phone.is_primary === true
            });
        }
    }
    // Extract email addresses
    const emails = [];
    if (result.emails && Array.isArray(result.emails)) {
        for (const email of result.emails) {
            emails.push({
                address: email.email_address,
                type: email.type || 'unknown',
                status: email.status || 'unknown',
                isDeliverable: email.deliverable === true,
                isPrimary: email.is_primary === true
            });
        }
    }
    // Calculate overall confidence score
    const hasGoodPhone = phones.some(p => p.isConnected);
    const hasGoodEmail = emails.some(e => e.isDeliverable);
    let confidence = 0;
    if (hasGoodPhone && hasGoodEmail)
        confidence = 90;
    else if (hasGoodPhone)
        confidence = 70;
    else if (hasGoodEmail)
        confidence = 50;
    else if (phones.length > 0 || emails.length > 0)
        confidence = 30;
    return {
        phones,
        emails,
        confidence
    };
}
/**
 * Check if BatchData API is available and working
 *
 * @returns Status of the BatchData API
 */
async function checkHealth() {
    // If BatchData is disabled or client wasn't initialized, return disabled status
    if (!isBatchEnabled || !batch) {
        return {
            service: 'BatchData API',
            enabled: false,
            status: 'disabled',
            message: 'BatchData API is disabled in configuration.'
        };
    }
    const startTime = Date.now();
    const endpoint = '/property/skip';
    try {
        // Try a basic skip trace with test data
        const payload = {
            address: '123 Main St',
            city: 'Beverly Hills',
            state: 'CA',
            zip: '90210'
        };
        const { status } = await batch.post(endpoint, payload);
        // Log the health check
        (0, vendorClient_1.logApiCall)('BatchData', `${endpoint} (Health Check)`, status, startTime);
        return {
            service: 'BatchData API',
            enabled: true,
            status: 'healthy',
            latency: Date.now() - startTime
        };
    }
    catch (error) {
        // Log the health check failure
        (0, vendorClient_1.logApiCall)('BatchData', `${endpoint} (Health Check)`, error.response?.status || 0, startTime, error);
        return {
            service: 'BatchData API',
            enabled: true,
            status: 'unhealthy',
            message: error.message,
            statusCode: error.response?.status,
            latency: Date.now() - startTime
        };
    }
}
exports.default = {
    skipTraceByAddress,
    processSkipTraceResults,
    checkHealth
};
//# sourceMappingURL=batchService.js.map
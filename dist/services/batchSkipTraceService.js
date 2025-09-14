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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchSkipTraceService = void 0;
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const dotenv = __importStar(require("dotenv"));
const addressNormalization_1 = require("../utils/addressNormalization");
dotenv.config();
const prisma = new client_1.PrismaClient();
/**
 * BatchData Skip Trace Service
 *
 * This service handles communication with the BatchData API for skip tracing
 * property owners and retrieving contact information.
 */
class BatchSkipTraceService {
    constructor() {
        this.maxRetries = 3;
        this.costPerLookupCents = 12; // Update with actual cost
        this.rateLimitPerMinute = 50;
        this.requestCount = 0;
        this.lastResetTime = Date.now();
        this.apiKey = process.env.BATCHDATA_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('BatchData API key not found in environment variables');
        }
        this.client = axios_1.default.create({
            baseURL: 'https://api.batchdata.com/api',
            headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000
        });
    }
    /**
     * Skip trace a property by address to find owner contact information
     *
     * @param request Skip trace request object
     * @returns Skip trace result with contact information
     */
    async skipTraceByAddress(request) {
        try {
            // Check rate limits
            await this.checkRateLimit();
            // Create the normalized address for deduplication
            const fullAddress = `${request.address}, ${request.city}, ${request.state} ${request.zipCode}`;
            const normalizedAddress = (0, addressNormalization_1.normalizeAddress)(fullAddress);
            // Check if we've already skip traced this property
            const existingLead = await prisma.lead.findFirst({
                where: {
                    // cast: schema may differ; use raw field or fallback
                    normalizedAddress,
                    skipTracedAt: { not: null }
                }
            });
            if (existingLead && (existingLead.ownerPhone || existingLead.phone)) {
                console.log(`Skip trace data already exists for ${normalizedAddress}`);
                return {
                    success: true,
                    ownerName: existingLead.ownerName || existingLead.owner_name || undefined,
                    ownerPhone: existingLead.ownerPhone || existingLead.phone || undefined,
                    ownerEmail: existingLead.ownerEmail || existingLead.email || undefined,
                    ownerAddress: existingLead.ownerAddress || existingLead.mailing_address || undefined,
                    phonesJson: existingLead.phonesJson || existingLead.phones_json || undefined,
                    emailsJson: existingLead.emailsJson || existingLead.emails_json || undefined,
                    dncFlag: existingLead.dncFlag || existingLead.dnc_flag || false,
                    cost: 0 // No cost since we're using cached data
                };
            }
            // Make the API request with retries
            const response = await this.makeRequestWithRetry('/v1/property/skip', {
                method: 'POST',
                data: {
                    address: request.address,
                    city: request.city,
                    state: request.state,
                    zip: request.zipCode,
                    firstName: request.firstName,
                    lastName: request.lastName
                }
            });
            if (!response?.data || response.data.status !== 'success') {
                console.log(`Skip trace failed for address: ${fullAddress}`);
                return { success: false, cost: 0 };
            }
            // Track the API usage cost
            const cost = this.costPerLookupCents;
            await this.trackApiUsage('property/skip', cost);
            // Process the skip trace results
            const result = response.data.result;
            const ownerInfo = this.processOwnerInfo(result);
            // Update the lead if it exists
            if (existingLead) {
                await prisma.lead.update({
                    where: { id: existingLead.id },
                    data: {
                        ownerName: ownerInfo.ownerName,
                        ownerPhone: ownerInfo.ownerPhone,
                        ownerEmail: ownerInfo.ownerEmail,
                        ownerAddress: ownerInfo.ownerAddress,
                        phonesJson: ownerInfo.phonesJson,
                        emailsJson: ownerInfo.emailsJson,
                        dncFlag: ownerInfo.dncFlag || false,
                        skipTraceProvider: 'batchdata',
                        skipTraceCostCents: cost,
                        skipTracedAt: new Date()
                    }
                });
            }
            return {
                ...ownerInfo,
                success: true,
                cost
            };
        }
        catch (error) {
            this.handleError(error, `Error skip tracing property: ${request.address}`);
            return { success: false, cost: 0 };
        }
    }
    /**
     * Skip trace multiple properties in batch
     *
     * @param requests Array of skip trace requests
     * @returns Array of skip trace results
     */
    async batchSkipTrace(requests) {
        const results = [];
        // Process in batches of 10 to avoid rate limits
        const batchSize = 10;
        const batches = [];
        for (let i = 0; i < requests.length; i += batchSize) {
            batches.push(requests.slice(i, i + batchSize));
        }
        for (const batch of batches) {
            // Process each batch with a delay between them
            const batchResults = await Promise.all(batch.map(request => this.skipTraceByAddress(request)));
            results.push(...batchResults);
            // Add a delay between batches to respect rate limits
            if (batches.indexOf(batch) < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        return results;
    }
    /**
     * Process the owner information from the API response
     */
    processOwnerInfo(result) {
        // Extract owner name
        const firstName = result.first_name || '';
        const lastName = result.last_name || '';
        const ownerName = (firstName && lastName) ? `${firstName} ${lastName}` : result.name || '';
        // Extract contact information
        const phones = result.phones || [];
        const emails = result.emails || [];
        // Get the best phone number (mobile preferred)
        let bestPhone = '';
        if (phones.length > 0) {
            const mobile = phones.find((p) => p.phone_type === 'mobile');
            bestPhone = mobile ? mobile.phone_number : phones[0].phone_number;
        }
        // Get the best email
        const ownerEmail = emails.length > 0 ? emails[0].email : '';
        // Get the owner address if different from property
        const ownerAddress = result.owner_address || '';
        // Check if on do-not-call list
        const dncFlag = result.dnc_flag || false;
        return {
            ownerName,
            ownerPhone: bestPhone,
            ownerEmail,
            ownerAddress,
            phonesJson: JSON.stringify(phones),
            emailsJson: JSON.stringify(emails),
            dncFlag
        };
    }
    /**
     * Check if we're within rate limits, wait if necessary
     */
    async checkRateLimit() {
        const currentTime = Date.now();
        const elapsedMinutes = (currentTime - this.lastResetTime) / (60 * 1000);
        if (elapsedMinutes >= 1) {
            // Reset counter if a minute has passed
            this.requestCount = 0;
            this.lastResetTime = currentTime;
        }
        if (this.requestCount >= this.rateLimitPerMinute) {
            // Wait until the next minute if we've hit the limit
            const waitTime = 60 * 1000 - (currentTime - this.lastResetTime);
            console.log(`Rate limit reached, waiting ${waitTime / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Reset counter
            this.requestCount = 0;
            this.lastResetTime = Date.now();
        }
        this.requestCount++;
    }
    /**
     * Track API usage for cost reporting
     */
    async trackApiUsage(endpoint, cost) {
        try {
            // Implement cost tracking logic here
            console.log(`API call to ${endpoint} - Cost: ${cost} cents`);
            // You could log to database or another tracking system here
        }
        catch (error) {
            console.error('Error tracking API usage:', error);
        }
    }
    /**
     * Make API request with automatic retry logic
     */
    async makeRequestWithRetry(endpoint, config, retries = 0) {
        try {
            if (config.method === 'POST') {
                return await this.client.post(endpoint, config.data);
            }
            else {
                return await this.client.get(endpoint, config);
            }
        }
        catch (error) {
            const axiosError = error;
            if (retries < this.maxRetries && this.isRetryableError(axiosError)) {
                console.log(`Retrying API call to ${endpoint} (attempt ${retries + 1}/${this.maxRetries})`);
                const delay = Math.pow(2, retries) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.makeRequestWithRetry(endpoint, config, retries + 1);
            }
            throw error;
        }
    }
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        const status = error.response?.status;
        return !status || status === 429 || status >= 500;
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
}
exports.BatchSkipTraceService = BatchSkipTraceService;
exports.default = new BatchSkipTraceService();
//# sourceMappingURL=batchSkipTraceService.js.map
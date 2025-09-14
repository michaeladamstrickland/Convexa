# FlipTracker Data Scraping Implementation Guide

## Introduction

This document provides technical implementation details for FlipTracker's data scraping infrastructure. It complements the high-level SCRAPING_STRATEGY_PLAN.md by offering concrete code examples, architectural patterns, and best practices.

## Recent Updates (September 2025)

### Data Fusion Implementation
We have implemented a new data fusion system to intelligently merge property data from multiple sources:

- **Source Reliability Ranking**: Prioritizes data from more reliable sources (ATTOM API > county records > listing sites)
- **Conflict Resolution**: Resolves conflicts in property data based on source reliability and data completeness
- **Data Completeness Scoring**: Evaluates which property record contains the most complete information
- **Contact Aggregation**: Merges contact data with confidence scoring when found in multiple sources
- **ATTOM Integration**: Specialized tools for enhancing scraped data with ATTOM API property data

For implementation details, see `src/fusion/README.md`.

## Architecture Overview

Our scraping architecture follows a modular, scalable design with these key components:

```
┌─────────────────┐     ┌────────────────┐     ┌────────────────┐
│                 │     │                │     │                │
│  Scraper        │────▶│  Data          │────▶│  Property      │
│  Orchestration  │     │  Processing    │     │  Database      │
│                 │     │                │     │                │
└─────────────────┘     └────────────────┘     └────────────────┘
        │                       │                      │
        ▼                       ▼                      ▼
┌─────────────────┐     ┌────────────────┐     ┌────────────────┐
│                 │     │                │     │                │
│  Proxy &        │     │  Data          │     │  API           │
│  Request Mgmt   │     │  Validation    │     │  Layer         │
│                 │     │                │     │                │
└─────────────────┘     └────────────────┘     └────────────────┘
```

## 1. Core Scraping Framework

### Scraper Base Class

```javascript
// scraper-base.js
class ScraperBase {
  constructor(config) {
    this.config = config;
    this.proxyManager = new ProxyManager(config.proxySettings);
    this.userAgentRotator = new UserAgentRotator();
    this.rateLimiter = new RateLimiter(config.rateLimit);
  }

  async initialize() {
    // Setup browser or HTTP client
    if (this.config.useBrowser) {
      this.browser = await this.setupBrowser();
    } else {
      this.httpClient = this.setupHttpClient();
    }
  }

  async setupBrowser() {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--proxy-server=${await this.proxyManager.getProxy()}`
      ]
    });
    return browser;
  }

  setupHttpClient() {
    return axios.create({
      headers: {
        'User-Agent': this.userAgentRotator.getRandomUserAgent()
      },
      // Additional HTTP client configuration
    });
  }

  async scrape() {
    throw new Error('Method scrape() must be implemented by subclass');
  }

  async extractData(html) {
    throw new Error('Method extractData() must be implemented by subclass');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = ScraperBase;
```

### County-Specific Implementation

```javascript
// county-scrapers/cook-county-scraper.js
const ScraperBase = require('../scraper-base');
const cheerio = require('cheerio');

class CookCountyScraper extends ScraperBase {
  constructor(config) {
    super({
      ...config,
      useBrowser: true, // Cook County site uses JavaScript
      rateLimit: { requestsPerMinute: 10 }
    });
    
    this.baseUrl = 'https://cookcountypropertyinfo.com';
    this.searchEndpoint = '/search';
  }

  async scrape(searchParams) {
    await this.initialize();
    
    try {
      const page = await this.browser.newPage();
      await this.configurePageForScraping(page);

      // Navigate to search page
      await page.goto(`${this.baseUrl}${this.searchEndpoint}`);
      
      // Fill search form
      await page.type('#address-input', searchParams.address);
      await page.type('#city-input', searchParams.city);
      await page.click('#search-button');
      
      // Wait for results
      await page.waitForSelector('.search-results');
      
      // Extract data
      const html = await page.content();
      const data = await this.extractData(html);
      
      return {
        source: 'cook-county',
        timestamp: new Date(),
        data
      };
    } catch (error) {
      console.error('Error scraping Cook County:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  async configurePageForScraping(page) {
    // Set random user agent
    await page.setUserAgent(this.userAgentRotator.getRandomUserAgent());
    
    // Block unnecessary resources for faster scraping
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Add additional headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });
  }

  async extractData(html) {
    const $ = cheerio.load(html);
    
    // Extract property data
    const propertyData = {
      pin: $('.pin-number').text().trim(),
      address: $('.property-address').text().trim(),
      owner: $('.owner-name').text().trim(),
      taxInfo: {
        assessedValue: this.extractCurrency($('.assessed-value').text()),
        taxAmount: this.extractCurrency($('.tax-amount').text())
      },
      propertyDetails: {
        squareFeet: this.extractNumber($('.square-feet').text()),
        bedrooms: this.extractNumber($('.bedrooms').text()),
        bathrooms: this.extractNumber($('.bathrooms').text()),
        yearBuilt: this.extractNumber($('.year-built').text())
      },
      lastSale: {
        date: $('.sale-date').text().trim(),
        amount: this.extractCurrency($('.sale-amount').text())
      }
    };
    
    return propertyData;
  }
  
  extractCurrency(text) {
    const match = text.match(/[\$\£\€]?[,\d]+\.?\d*/);
    if (!match) return null;
    
    return parseFloat(match[0].replace(/[\$\£\€,]/g, ''));
  }
  
  extractNumber(text) {
    const match = text.match(/\d+\.?\d*/);
    return match ? parseFloat(match[0]) : null;
  }
}

module.exports = CookCountyScraper;
```

## 2. Proxy & Request Management

### Proxy Manager

```javascript
// proxy-manager.js
class ProxyManager {
  constructor(config = {}) {
    this.proxies = config.proxies || [];
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
    this.currentProxyIndex = 0;
    this.proxyFailures = {};
  }

  async getProxy() {
    // If using a proxy API service
    if (this.apiKey) {
      return this.getProxyFromService();
    }
    
    // If using a static proxy list
    if (this.proxies.length === 0) {
      throw new Error('No proxies available');
    }
    
    // Rotate through available proxies
    const proxy = this.proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    
    return proxy;
  }
  
  async getProxyFromService() {
    try {
      const response = await axios.get(this.apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      return response.data.proxy;
    } catch (error) {
      console.error('Failed to fetch proxy from service:', error);
      throw error;
    }
  }
  
  reportProxyFailure(proxy) {
    if (!this.proxyFailures[proxy]) {
      this.proxyFailures[proxy] = 0;
    }
    
    this.proxyFailures[proxy]++;
    
    // If proxy failed too many times, remove it from rotation
    if (this.proxyFailures[proxy] >= 3) {
      this.proxies = this.proxies.filter(p => p !== proxy);
      console.log(`Removed failing proxy: ${proxy}`);
    }
  }
}

module.exports = ProxyManager;
```

### User Agent Rotator

```javascript
// user-agent-rotator.js
class UserAgentRotator {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:94.0) Gecko/20100101 Firefox/94.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/96.0.4664.53 Mobile/15E148 Safari/604.1'
    ];
  }
  
  getRandomUserAgent() {
    const randomIndex = Math.floor(Math.random() * this.userAgents.length);
    return this.userAgents[randomIndex];
  }
  
  addUserAgent(userAgent) {
    if (!this.userAgents.includes(userAgent)) {
      this.userAgents.push(userAgent);
    }
  }
}

module.exports = UserAgentRotator;
```

### Rate Limiter

```javascript
// rate-limiter.js
class RateLimiter {
  constructor({ requestsPerMinute = 30, maxConcurrent = 5 } = {}) {
    this.requestsPerMinute = requestsPerMinute;
    this.maxConcurrent = maxConcurrent;
    
    this.requestTimestamps = [];
    this.activeRequests = 0;
    this.requestQueue = [];
  }
  
  async acquireSlot() {
    // Check if we're at the concurrent request limit
    if (this.activeRequests >= this.maxConcurrent) {
      await new Promise(resolve => {
        this.requestQueue.push(resolve);
      });
    }
    
    // Check rate limit
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    // Clean up old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    
    // If we're at the rate limit, wait until we can make another request
    if (this.requestTimestamps.length >= this.requestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const timeToWait = 60 * 1000 - (now - oldestTimestamp);
      
      await new Promise(resolve => setTimeout(resolve, timeToWait));
      
      // Recursive call after waiting
      return this.acquireSlot();
    }
    
    // Acquire slot
    this.activeRequests++;
    this.requestTimestamps.push(now);
  }
  
  releaseSlot() {
    this.activeRequests--;
    
    // If there are waiting requests and we have capacity, resolve the oldest one
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const resolve = this.requestQueue.shift();
      resolve();
    }
  }
  
  async throttle(fn) {
    try {
      await this.acquireSlot();
      return await fn();
    } finally {
      this.releaseSlot();
    }
  }
}

module.exports = RateLimiter;
```

## 3. Scraper Orchestration System

### Scraper Registry

```javascript
// scraper-registry.js
class ScraperRegistry {
  constructor() {
    this.scrapers = {};
  }
  
  register(key, ScraperClass, config = {}) {
    this.scrapers[key] = {
      ScraperClass,
      config
    };
  }
  
  async getScraper(key) {
    const scraper = this.scrapers[key];
    
    if (!scraper) {
      throw new Error(`No scraper registered for key: ${key}`);
    }
    
    const instance = new scraper.ScraperClass(scraper.config);
    await instance.initialize();
    
    return instance;
  }
  
  getRegisteredScrapers() {
    return Object.keys(this.scrapers);
  }
}

module.exports = new ScraperRegistry();
```

### Orchestration Service

```javascript
// scraper-orchestrator.js
const ScraperRegistry = require('./scraper-registry');
const { PropertyDataProcessor } = require('../data-processing');
const { TaskQueue } = require('../utils');

class ScraperOrchestrator {
  constructor(config = {}) {
    this.dataProcessor = new PropertyDataProcessor();
    this.taskQueue = new TaskQueue({
      concurrency: config.concurrentTasks || 5,
      retryAttempts: config.retryAttempts || 3
    });
  }
  
  async schedulePropertySearch(searchParams) {
    // Determine which scrapers to use
    const scraperKeys = this.determineRelevantScrapers(searchParams);
    
    // Create tasks for each scraper
    const tasks = scraperKeys.map(key => async () => {
      try {
        const scraper = await ScraperRegistry.getScraper(key);
        const result = await scraper.scrape(searchParams);
        
        // Process and store the results
        await this.dataProcessor.processScrapedData(result, searchParams);
        
        return {
          success: true,
          scraperKey: key,
          data: result
        };
      } catch (error) {
        console.error(`Error in scraper ${key}:`, error);
        return {
          success: false,
          scraperKey: key,
          error: error.message
        };
      }
    });
    
    // Add tasks to queue and return the job ID
    const jobId = await this.taskQueue.addTasks(tasks);
    return jobId;
  }
  
  determineRelevantScrapers(searchParams) {
    const allScrapers = ScraperRegistry.getRegisteredScrapers();
    
    // If county is specified, use that specific scraper
    if (searchParams.county) {
      const countyScraperKey = `county-${searchParams.county.toLowerCase().replace(/\s+/g, '-')}`;
      if (allScrapers.includes(countyScraperKey)) {
        return [countyScraperKey];
      }
    }
    
    // If state is specified, use all scrapers for that state
    if (searchParams.state) {
      const stateCode = searchParams.state.toLowerCase();
      return allScrapers.filter(key => key.includes(`-${stateCode}-`));
    }
    
    // Default: use all scrapers
    return allScrapers;
  }
  
  async getJobStatus(jobId) {
    return this.taskQueue.getJobStatus(jobId);
  }
}

module.exports = ScraperOrchestrator;
```

## 4. Data Processing Pipeline

### Property Data Processor

```javascript
// property-data-processor.js
const { PropertyModel } = require('../models');
const { AddressNormalizer, OwnerNameNormalizer } = require('./normalizers');

class PropertyDataProcessor {
  constructor() {
    this.addressNormalizer = new AddressNormalizer();
    this.ownerNameNormalizer = new OwnerNameNormalizer();
  }
  
  async processScrapedData(scrapedData, searchParams) {
    // Normalize the data
    const normalizedData = await this.normalizeData(scrapedData);
    
    // Find or create property record
    let property = await PropertyModel.findOne({
      normalizedAddress: normalizedData.normalizedAddress
    });
    
    if (!property) {
      property = new PropertyModel({
        normalizedAddress: normalizedData.normalizedAddress,
        dataSources: []
      });
    }
    
    // Update property with new data
    this.updatePropertyWithScrapedData(property, normalizedData, scrapedData.source);
    
    // Save the property
    await property.save();
    
    return property;
  }
  
  async normalizeData(scrapedData) {
    const { data } = scrapedData;
    
    // Construct full address for normalization
    const fullAddress = `${data.address}, ${data.city}, ${data.state} ${data.zipCode}`;
    
    return {
      normalizedAddress: await this.addressNormalizer.normalize(fullAddress),
      normalizedOwnerName: await this.ownerNameNormalizer.normalize(data.owner),
      // Add other normalized fields...
      originalData: data
    };
  }
  
  updatePropertyWithScrapedData(property, normalizedData, source) {
    // Find existing data source entry or create new one
    let dataSource = property.dataSources.find(ds => ds.source === source);
    
    if (!dataSource) {
      dataSource = {
        source,
        firstCollected: new Date(),
        data: {}
      };
      property.dataSources.push(dataSource);
    }
    
    // Update data source
    dataSource.lastUpdated = new Date();
    dataSource.data = normalizedData.originalData;
    
    // Update core property fields, preferring more complete/recent data
    this.updatePropertyCoreFields(property, normalizedData, source);
  }
  
  updatePropertyCoreFields(property, normalizedData, source) {
    const data = normalizedData.originalData;
    
    // Update owner information if available
    if (data.owner) {
      property.ownerName = normalizedData.normalizedOwnerName;
      property.ownerInfo = {
        ...property.ownerInfo,
        name: data.owner,
        normalizedName: normalizedData.normalizedOwnerName
      };
    }
    
    // Update address components if available
    if (data.address) {
      property.address = {
        ...property.address,
        street: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        normalizedAddress: normalizedData.normalizedAddress
      };
    }
    
    // Update property characteristics if available
    if (data.propertyDetails) {
      property.characteristics = {
        ...property.characteristics,
        squareFeet: data.propertyDetails.squareFeet || property.characteristics?.squareFeet,
        bedrooms: data.propertyDetails.bedrooms || property.characteristics?.bedrooms,
        bathrooms: data.propertyDetails.bathrooms || property.characteristics?.bathrooms,
        yearBuilt: data.propertyDetails.yearBuilt || property.characteristics?.yearBuilt
      };
    }
    
    // Update financial information if available
    if (data.taxInfo) {
      property.financialInfo = {
        ...property.financialInfo,
        taxAssessedValue: data.taxInfo.assessedValue || property.financialInfo?.taxAssessedValue,
        taxAmount: data.taxInfo.taxAmount || property.financialInfo?.taxAmount,
        taxYear: data.taxInfo.taxYear || property.financialInfo?.taxYear
      };
    }
    
    // Update last sale information if available
    if (data.lastSale) {
      // Only update if the sale date is more recent than what we have
      const currentLastSaleDate = property.lastSale?.date ? new Date(property.lastSale.date) : null;
      const newLastSaleDate = data.lastSale.date ? new Date(data.lastSale.date) : null;
      
      if (!currentLastSaleDate || (newLastSaleDate && newLastSaleDate > currentLastSaleDate)) {
        property.lastSale = {
          date: data.lastSale.date,
          amount: data.lastSale.amount,
          source
        };
      }
    }
    
    // Update metadata
    property.lastUpdated = new Date();
    
    if (!property.sources.includes(source)) {
      property.sources.push(source);
    }
  }
}

module.exports = { PropertyDataProcessor };
```

## 5. Data Models

### Property Model

```javascript
// property-model.js
const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  // Core property identifiers
  normalizedAddress: {
    type: String,
    required: true,
    index: true
  },
  
  // Address components
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    normalizedAddress: String,
    latitude: Number,
    longitude: Number
  },
  
  // Property characteristics
  characteristics: {
    propertyType: String,
    squareFeet: Number,
    lotSize: Number,
    bedrooms: Number,
    bathrooms: Number,
    stories: Number,
    yearBuilt: Number,
    pool: Boolean,
    garage: Number,
    parkingSpaces: Number
  },
  
  // Owner information
  ownerName: String,
  ownerInfo: {
    name: String,
    normalizedName: String,
    ownerOccupied: Boolean,
    mailingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      normalizedAddress: String
    }
  },
  
  // Financial information
  financialInfo: {
    taxAssessedValue: Number,
    taxMarketValue: Number,
    taxAmount: Number,
    taxYear: String,
    estimatedValue: Number,
    estimatedValueRange: {
      low: Number,
      high: Number
    }
  },
  
  // Last sale information
  lastSale: {
    date: Date,
    amount: Number,
    buyerName: String,
    sellerName: String,
    source: String
  },
  
  // All data sources that contributed to this property
  sources: [String],
  
  // Complete data from each source
  dataSources: [{
    source: String,
    firstCollected: Date,
    lastUpdated: Date,
    data: mongoose.Schema.Types.Mixed
  }],
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Indexes for common queries
propertySchema.index({ 'address.city': 1, 'address.state': 1 });
propertySchema.index({ 'address.zipCode': 1 });
propertySchema.index({ ownerName: 1 });
propertySchema.index({ 'financialInfo.taxAssessedValue': 1 });
propertySchema.index({ 'lastSale.date': 1 });

const PropertyModel = mongoose.model('Property', propertySchema);

module.exports = { PropertyModel };
```

## 6. Foreclosure Scraping Implementation

```javascript
// scrapers/foreclosure-scraper.js
const ScraperBase = require('../scraper-base');
const { parseDate, extractCurrency } = require('../utils/parsers');

class ForeclosureScraper extends ScraperBase {
  constructor(config) {
    super({
      ...config,
      useBrowser: true,
      rateLimit: { requestsPerMinute: 5 }
    });
    
    this.baseUrl = 'https://foreclosuresource.com'; // Example URL
    this.searchEndpoint = '/foreclosures/search';
  }
  
  async scrape(searchParams) {
    await this.initialize();
    const { county, state, zipCode } = searchParams;
    
    try {
      const page = await this.browser.newPage();
      await this.configurePageForScraping(page);
      
      // Navigate to search page
      await page.goto(`${this.baseUrl}${this.searchEndpoint}`);
      
      // Select state
      await page.select('#state-select', state);
      
      // Wait for county dropdown to populate
      await page.waitForSelector('#county-select option');
      
      // Select county if provided
      if (county) {
        await page.select('#county-select', county);
      }
      
      // Enter ZIP code if provided
      if (zipCode) {
        await page.type('#zip-input', zipCode);
      }
      
      // Submit search
      await page.click('#search-button');
      
      // Wait for results
      await page.waitForSelector('.foreclosure-results');
      
      // Parse results
      let results = [];
      let hasMorePages = true;
      let currentPage = 1;
      
      while (hasMorePages && currentPage <= 5) { // Limit to 5 pages for safety
        // Extract data from current page
        const html = await page.content();
        const pageResults = this.extractForeclosureData(html);
        
        results = [...results, ...pageResults];
        
        // Check if there's a next page
        const nextPageButton = await page.$('.pagination .next:not(.disabled)');
        if (nextPageButton) {
          await nextPageButton.click();
          await page.waitForSelector('.foreclosure-results');
          currentPage++;
        } else {
          hasMorePages = false;
        }
      }
      
      return {
        source: 'foreclosure-listings',
        timestamp: new Date(),
        searchParams,
        data: results
      };
    } catch (error) {
      console.error('Error scraping foreclosure data:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  extractForeclosureData(html) {
    const $ = cheerio.load(html);
    const results = [];
    
    $('.foreclosure-listing').each((i, el) => {
      const listing = $(el);
      
      const result = {
        address: listing.find('.property-address').text().trim(),
        city: listing.find('.property-city').text().trim(),
        state: listing.find('.property-state').text().trim(),
        zipCode: listing.find('.property-zip').text().trim(),
        
        auctionDate: parseDate(listing.find('.auction-date').text().trim()),
        auctionTime: listing.find('.auction-time').text().trim(),
        auctionLocation: listing.find('.auction-location').text().trim(),
        
        openingBid: extractCurrency(listing.find('.opening-bid').text()),
        estimatedValue: extractCurrency(listing.find('.estimated-value').text()),
        
        propertyDetails: {
          bedrooms: this.extractNumber(listing.find('.bedrooms').text()),
          bathrooms: this.extractNumber(listing.find('.bathrooms').text()),
          squareFeet: this.extractNumber(listing.find('.square-feet').text()),
          yearBuilt: this.extractNumber(listing.find('.year-built').text()),
          propertyType: listing.find('.property-type').text().trim()
        },
        
        legalDescription: listing.find('.legal-description').text().trim(),
        
        caseNumber: listing.find('.case-number').text().trim(),
        parcelId: listing.find('.parcel-id').text().trim(),
        
        // Get link to detail page
        detailUrl: listing.find('a.view-details').attr('href')
      };
      
      results.push(result);
    });
    
    return results;
  }
  
  extractNumber(text) {
    const match = text.match(/\d+\.?\d*/);
    return match ? parseFloat(match[0]) : null;
  }
}

module.exports = ForeclosureScraper;
```

## 7. Schedule & Automation

### Scheduler Implementation

```javascript
// scheduler.js
const cron = require('node-cron');
const { ScraperOrchestrator } = require('./scraper-orchestrator');
const { SearchParametersGenerator } = require('./search-parameters-generator');
const { TaskQueueMonitor } = require('./task-queue-monitor');
const { NotificationService } = require('./notification-service');

class ScrapeScheduler {
  constructor(config = {}) {
    this.config = config;
    this.orchestrator = new ScraperOrchestrator(config.orchestrator);
    this.searchGenerator = new SearchParametersGenerator();
    this.monitor = new TaskQueueMonitor();
    this.notifications = new NotificationService();
    
    this.scheduledJobs = {};
  }
  
  initialize() {
    // Schedule regular scraping tasks
    this.scheduleRecurringTasks();
    
    // Start monitoring system
    this.monitor.start();
  }
  
  scheduleRecurringTasks() {
    // Daily foreclosure scraping at 2 AM
    this.scheduledJobs.foreclosures = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('Starting scheduled foreclosure scraping...');
        
        // Generate search parameters for each target county
        const searchParams = await this.searchGenerator.generateForeclosureSearchParameters();
        
        // Schedule the scraping tasks
        for (const params of searchParams) {
          await this.orchestrator.schedulePropertySearch(params);
        }
        
        console.log('Scheduled foreclosure scraping completed.');
      } catch (error) {
        console.error('Error in scheduled foreclosure scraping:', error);
        this.notifications.sendErrorAlert('Scheduled Foreclosure Scraping Failed', error);
      }
    });
    
    // Weekly tax data update at 3 AM on Sundays
    this.scheduledJobs.taxData = cron.schedule('0 3 * * 0', async () => {
      try {
        console.log('Starting scheduled tax data update...');
        
        // Generate search parameters based on properties that need updates
        const searchParams = await this.searchGenerator.generateTaxDataUpdateParameters();
        
        // Schedule the scraping tasks
        for (const params of searchParams) {
          await this.orchestrator.schedulePropertySearch(params);
        }
        
        console.log('Scheduled tax data update completed.');
      } catch (error) {
        console.error('Error in scheduled tax data update:', error);
        this.notifications.sendErrorAlert('Scheduled Tax Data Update Failed', error);
      }
    });
    
    // Monthly property data refresh at 4 AM on the 1st
    this.scheduledJobs.fullRefresh = cron.schedule('0 4 1 * *', async () => {
      try {
        console.log('Starting monthly property data refresh...');
        
        // Generate search parameters for properties that need a refresh
        const searchParams = await this.searchGenerator.generateDataRefreshParameters();
        
        // Schedule the scraping tasks with high priority
        for (const params of searchParams) {
          await this.orchestrator.schedulePropertySearch(params, { priority: 'high' });
        }
        
        console.log('Monthly property data refresh scheduled.');
      } catch (error) {
        console.error('Error in monthly property data refresh:', error);
        this.notifications.sendErrorAlert('Monthly Property Data Refresh Failed', error);
      }
    });
  }
  
  stopAllJobs() {
    Object.values(this.scheduledJobs).forEach(job => job.stop());
    this.monitor.stop();
    console.log('All scheduled jobs stopped.');
  }
  
  async scheduleImmediateTask(searchParams) {
    try {
      const jobId = await this.orchestrator.schedulePropertySearch(searchParams, { priority: 'immediate' });
      return jobId;
    } catch (error) {
      console.error('Error scheduling immediate task:', error);
      throw error;
    }
  }
}

module.exports = { ScrapeScheduler };
```

## 8. Deployment Configuration

### Docker Deployment

```dockerfile
# Dockerfile for Scraper Service
FROM node:16-alpine

# Install Chromium for Puppeteer
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      freetype-dev \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Create non-root user
RUN addgroup -S appuser && adduser -S -G appuser appuser
USER appuser

# Expose port
EXPOSE 3000

# Start the application
CMD [ "node", "server.js" ]
```

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  scraper-service:
    build: ./scraper-service
    container_name: scraper-service
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/fliptracker
      - REDIS_URL=redis://redis:6379
      - API_KEY=${API_KEY}
      - PROXY_API_URL=${PROXY_API_URL}
    depends_on:
      - mongodb
      - redis
    volumes:
      - ./logs:/usr/src/app/logs
      - ./config:/usr/src/app/config
    networks:
      - fliptracker-network

  mongodb:
    image: mongo:5.0
    container_name: mongodb
    restart: unless-stopped
    volumes:
      - mongodb-data:/data/db
    networks:
      - fliptracker-network

  redis:
    image: redis:6-alpine
    container_name: redis
    restart: unless-stopped
    volumes:
      - redis-data:/data
    networks:
      - fliptracker-network

  proxy-manager:
    image: nginx:alpine
    container_name: proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx:/etc/nginx/conf.d
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    networks:
      - fliptracker-network

volumes:
  mongodb-data:
  redis-data:

networks:
  fliptracker-network:
    driver: bridge
```

## 9. Monitoring & Error Handling

### Error Handler Implementation

```javascript
// error-handler.js
const { NotificationService } = require('./notification-service');
const { ErrorLogModel } = require('../models');

class ScraperErrorHandler {
  constructor() {
    this.notifications = new NotificationService();
  }
  
  async handleError(error, context = {}) {
    try {
      console.error('Scraper Error:', error);
      
      // Log error to database
      await this.logErrorToDb(error, context);
      
      // Determine error severity
      const severity = this.determineSeverity(error, context);
      
      // Send notifications based on severity
      if (severity >= 3) {
        await this.notifications.sendErrorAlert(
          `Scraper Error (Severity ${severity})`, 
          error.message, 
          { ...context, stack: error.stack }
        );
      }
      
      // Handle specific error types
      if (error.name === 'ProxyError') {
        await this.handleProxyError(error, context);
      } else if (error.name === 'RateLimitError') {
        await this.handleRateLimitError(error, context);
      } else if (error.name === 'DataExtractionError') {
        await this.handleDataExtractionError(error, context);
      }
    } catch (loggingError) {
      // Last resort error handling
      console.error('Error in error handler:', loggingError);
    }
  }
  
  async logErrorToDb(error, context) {
    try {
      const errorLog = new ErrorLogModel({
        name: error.name,
        message: error.message,
        stack: error.stack,
        context: JSON.stringify(context),
        timestamp: new Date()
      });
      
      await errorLog.save();
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
    }
  }
  
  determineSeverity(error, context) {
    // Scale: 1 (low) to 5 (critical)
    
    // Critical errors
    if (error.name === 'DatabaseConnectionError') return 5;
    if (context.isRecurring && context.failureCount > 3) return 5;
    
    // High severity
    if (error.name === 'ProxyBanError') return 4;
    if (context.affectedProperties > 100) return 4;
    
    // Medium severity
    if (error.name === 'RateLimitError') return 3;
    if (error.name === 'DataExtractionError') return 3;
    if (context.isRecurring) return 3;
    
    // Low severity
    if (error.name === 'TimeoutError') return 2;
    if (error.name === 'TemporaryNetworkError') return 2;
    
    // Default: low-medium
    return 2;
  }
  
  async handleProxyError(error, context) {
    // Get proxy manager instance
    const { proxyManager } = context;
    
    if (proxyManager && error.proxyUrl) {
      // Report proxy failure
      proxyManager.reportProxyFailure(error.proxyUrl);
      
      // If this is a ban, take more drastic action
      if (error.name === 'ProxyBanError') {
        await this.notifications.sendErrorAlert(
          'Proxy Ban Detected', 
          `Proxy ${error.proxyUrl} has been banned from ${context.targetSite || 'unknown site'}`,
          { duration: error.banDuration || 'unknown' }
        );
      }
    }
  }
  
  async handleRateLimitError(error, context) {
    // Adjust rate limits for the source
    const { source } = context;
    
    if (source) {
      // Update rate limit configuration
      await this.updateRateLimitConfig(source, {
        decrease: true,
        backoffFactor: 1.5
      });
      
      console.log(`Decreased rate limit for ${source} due to rate limit error`);
    }
  }
  
  async handleDataExtractionError(error, context) {
    // This could indicate a site structure change
    const { source, html } = context;
    
    if (source && html) {
      // Save sample of the HTML that caused the error
      await this.saveHtmlSample(source, html, error);
      
      // Alert about possible site structure change
      await this.notifications.sendErrorAlert(
        'Possible Website Structure Change',
        `Data extraction failed for ${source}. Site structure may have changed.`,
        { errorLocation: error.location || 'unknown' }
      );
    }
  }
  
  async updateRateLimitConfig(source, options) {
    // Implementation to update rate limit configuration
  }
  
  async saveHtmlSample(source, html, error) {
    // Implementation to save HTML sample
  }
}

module.exports = { ScraperErrorHandler };
```

## 10. Compliance & Ethics

### Terms of Service Checker

```javascript
// tos-checker.js
class TermsOfServiceChecker {
  constructor() {
    this.tosDatabase = {};
    this.violationPatterns = {
      rateLimits: [
        'rate limit',
        'requests per minute',
        'request frequency',
        'automated access'
      ],
      scraping: [
        'scraping',
        'web crawling',
        'data mining',
        'automated collection',
        'robots'
      ],
      userAgents: [
        'user agent',
        'browser identification',
        'misrepresentation'
      ]
    };
  }
  
  async initialize() {
    // Load TOS database from storage
    try {
      const storedTosDatabase = await this.loadTosDatabase();
      this.tosDatabase = storedTosDatabase;
    } catch (error) {
      console.error('Error loading TOS database:', error);
    }
  }
  
  async checkCompliance(domain, options = {}) {
    // Get TOS for the domain
    const tos = await this.getTosForDomain(domain);
    
    if (!tos) {
      return {
        isCompliant: null,
        reason: 'TOS not available',
        recommendations: ['Manually review the website TOS before scraping']
      };
    }
    
    // Check for violations
    const violations = [];
    
    // Check for rate limit violations
    if (options.requestsPerMinute) {
      const rateLimitInfo = this.extractRateLimitInfo(tos.content);
      
      if (rateLimitInfo && rateLimitInfo.limit && options.requestsPerMinute > rateLimitInfo.limit) {
        violations.push({
          type: 'rateLimit',
          description: `Rate limit violation. TOS allows ${rateLimitInfo.limit} requests per minute, but configuration is set to ${options.requestsPerMinute}.`,
          severity: 'high'
        });
      }
    }
    
    // Check for scraping prohibitions
    const scrapingProhibitions = this.extractScrapingProhibitions(tos.content);
    if (scrapingProhibitions.isProhibited) {
      violations.push({
        type: 'scraping',
        description: `Website explicitly prohibits scraping: "${scrapingProhibitions.text}"`,
        severity: 'critical'
      });
    }
    
    // Check for user agent requirements
    const userAgentRequirements = this.extractUserAgentRequirements(tos.content);
    if (userAgentRequirements.hasRequirements && options.useRandomUserAgents) {
      violations.push({
        type: 'userAgent',
        description: `Website requires accurate User-Agent identification: "${userAgentRequirements.text}"`,
        severity: 'high'
      });
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(violations, tos, options);
    
    return {
      isCompliant: violations.length === 0,
      violations,
      lastChecked: tos.lastChecked,
      recommendations
    };
  }
  
  async getTosForDomain(domain) {
    // Check if we have a cached version
    if (this.tosDatabase[domain]) {
      const cachedTos = this.tosDatabase[domain];
      
      // Check if TOS needs to be refreshed (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (new Date(cachedTos.lastChecked) < thirtyDaysAgo) {
        // Refresh TOS in background
        this.refreshTos(domain).catch(error => {
          console.error(`Error refreshing TOS for ${domain}:`, error);
        });
      }
      
      return cachedTos;
    }
    
    // If not cached, fetch TOS
    try {
      const tos = await this.fetchTos(domain);
      return tos;
    } catch (error) {
      console.error(`Error fetching TOS for ${domain}:`, error);
      return null;
    }
  }
  
  async fetchTos(domain) {
    // Implementation to fetch TOS from website
    // This would use a headless browser or HTTP client to locate and download the TOS
  }
  
  async refreshTos(domain) {
    // Implementation to refresh TOS for a domain
  }
  
  extractRateLimitInfo(tosContent) {
    // Implementation to extract rate limit information from TOS content
  }
  
  extractScrapingProhibitions(tosContent) {
    // Implementation to extract scraping prohibitions from TOS content
  }
  
  extractUserAgentRequirements(tosContent) {
    // Implementation to extract user agent requirements from TOS content
  }
  
  generateRecommendations(violations, tos, options) {
    // Implementation to generate recommendations based on violations
  }
  
  async loadTosDatabase() {
    // Implementation to load TOS database from storage
  }
  
  async saveTosDatabase() {
    // Implementation to save TOS database to storage
  }
}

module.exports = { TermsOfServiceChecker };
```

## 13. Data Fusion & Storage System

We've implemented a comprehensive data fusion and storage system for property records:

### Property Fusion

```javascript
// src/fusion/propertyFusion.cjs
function fuseProperties(attom, items) {
  // Select base record with most complete information
  const base = pickMostComplete(items);
  
  // Create fused lead record
  const lead = {
    address: base.address,
    addressHash: base.addressHash || '',
    ownerName: base.ownerName ?? attom?.owner?.owner1?.name ?? null,
    parcelId: attom?.identifier?.obPropId ?? base.parcelId ?? null,
    apn: attom?.identifier?.apn ?? null,
    // Additional properties...
    
    // Combine all distress signals
    distressSignals: Array.from(
      new Set(items.flatMap(i => i.distressSignals || []))
    ),
    
    // Track all sources
    sources: items.map(i => ({
      key: i.sourceKey || 'unknown',
      url: i.sourceUrl || null,
      capturedAt: i.capturedAt || null,
      reliability: getSourceReliability(i.sourceKey)
    })),
    
    // Track conflicts for auditing
    conflicts: {}
  };
  
  // Merge numeric attributes with source preference
  mergeNumericAttributes(lead, attom, items);
  
  // Merge contacts with highest confidence
  mergeContacts(lead, items);
  
  return lead;
}
```

### Enhanced Property Store

```javascript
// src/storage/propertyStoreWithFusion.cjs
class PropertyStoreWithFusion extends PropertyStore {
  constructor(options = {}) {
    super(options);
    this.attomClient = options.attomClient || null;
  }
  
  async storePropertyWithFusion(property, options = {}) {
    // Implementation details...
    
    // Get existing property
    const existingProperty = await this.getPropertyByAddress(addrStr);
    
    if (existingProperty) {
      // Get ATTOM data if available and not provided
      let attomDataToUse = attomData;
      
      if (!attomDataToUse && this.attomClient && existingProperty.addressHash) {
        attomDataToUse = await this.attomClient.getPropertyData(existingProperty.addressHash);
      }
      
      // Perform fusion of new and existing property data
      const fusedProperty = fuseProperties(attomDataToUse, [existingProperty, property]);
      
      // Store the fused property
      return super.storeProperty(fusedProperty);
    }
    
    // No existing property or fusion skipped - store normally
    return super.storeProperty(property);
  }
  
  // Batch processing methods...
}
```

## 14. System Upgrades and Enhancements

### Browser & Anti-bot Hardening with Playwright

Replacing Puppeteer with Playwright for better stealth capabilities:

```javascript
// src/scraping/browser.ts
const { chromium } = require('playwright');

class PlaywrightBrowserManager {
  constructor(config = {}) {
    this.config = config;
    this.browser = null;
  }

  async launchBrowser(proxy) {
    return chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        ...(proxy ? [`--proxy-server=${proxy}`] : [])
      ]
    });
  }

  async prepPage(page, userAgent) {
    // Set language
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    
    // Set user agent
    await page.setUserAgent(userAgent);
    
    // Hide automation flags
    await page.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Modify permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery(parameters);
      };
      
      // Add plugins to seem more human-like
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: 'application/pdf' },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            name: 'Chrome PDF Plugin',
            length: 1
          }
        ]
      });
      
      // Add language plugins for more human fingerprint
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    });
    
    // Block unnecessary resources for speed
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Add human-like behavior if enabled
    if (this.config.humanBehavior) {
      await this.enableHumanBehavior(page);
    }
  }
  
  async enableHumanBehavior(page) {
    // Add random mouse movements
    await page.mouse.move(
      100 + Math.floor(Math.random() * 100),
      100 + Math.floor(Math.random() * 100),
      { steps: 10 }
    );
    
    // Add random scrolling behavior
    await page.evaluate(() => {
      const randomScroll = () => {
        const maxY = Math.max(document.body.scrollHeight, 1000);
        const targetY = Math.floor(Math.random() * maxY);
        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
      };
      
      randomScroll();
    });
    
    // Add random delays between actions
    await page.waitForTimeout(200 + Math.floor(Math.random() * 1000));
  }
  
  async setupChallengeHandler(page) {
    if (!this.config.captchaService) return;
    
    const { apiKey, service } = this.config.captchaService;
    
    // Set up 2captcha or Anti-Captcha
    const captchaSolver = service === '2captcha' 
      ? new TwoCaptcha(apiKey)
      : new AntiCaptcha(apiKey);
    
    // Monitor for recaptcha
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.includes('recaptcha') || url.includes('captcha')) {
        // Log captcha detection
        console.log('Captcha detected, solving...');
        
        try {
          const solution = await captchaSolver.solve(url, page);
          // Apply solution to the page
          await page.evaluate((sol) => {
            window.grecaptcha.getResponse = () => sol;
          }, solution);
          
          console.log('Captcha solved successfully');
        } catch (error) {
          console.error('Failed to solve captcha:', error);
        }
      }
      route.continue();
    });
  }
}

module.exports = { PlaywrightBrowserManager };
```

### ScraperBase Class with Playwright Integration

```javascript
// scraper-base-playwright.js
const { PlaywrightBrowserManager } = require('./browser');
const { UserAgentRotator } = require('./user-agent-rotator');
const { RateLimiter } = require('./rate-limiter');
const { ProxyManager } = require('./proxy-manager');

class PlaywrightScraperBase {
  constructor(config) {
    this.config = config;
    this.proxyManager = new ProxyManager(config.proxySettings);
    this.userAgentRotator = new UserAgentRotator();
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.browserManager = new PlaywrightBrowserManager({
      humanBehavior: config.humanBehavior || false,
      captchaService: config.captchaService
    });
    this.browser = null;
    this.context = null;
  }

  async initialize() {
    try {
      // Get proxy if configured
      const proxy = this.config.useProxy 
        ? await this.proxyManager.getProxy()
        : null;
      
      // Launch browser
      this.browser = await this.browserManager.launchBrowser(proxy);
      
      // Create browser context
      this.context = await this.browser.newContext({
        viewport: {
          width: 1920 + Math.floor(Math.random() * 100),
          height: 1080 + Math.floor(Math.random() * 100)
        },
        userAgent: this.userAgentRotator.getRandomUserAgent(),
        locale: 'en-US',
        timezoneId: 'America/New_York',
        geolocation: {
          latitude: 40.730610,
          longitude: -73.935242
        },
        permissions: ['geolocation']
      });
    } catch (error) {
      console.error('Error initializing PlaywrightScraper:', error);
      throw error;
    }
  }

  async newPage() {
    const page = await this.context.newPage();
    await this.browserManager.prepPage(
      page, 
      this.userAgentRotator.getRandomUserAgent()
    );
    
    if (this.config.captchaService) {
      await this.browserManager.setupChallengeHandler(page);
    }
    
    return page;
  }

  async scrape() {
    throw new Error('Method scrape() must be implemented by subclass');
  }

  async extractData(html) {
    throw new Error('Method extractData() must be implemented by subclass');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = PlaywrightScraperBase;
```

### TypeScript Contracts for Standardized Output

```typescript
// src/types/ScrapeResult.ts
export type DistressSignal =
  | "FSBO" | "CODE_VIOLATION" | "TAX_DELINQUENT"
  | "PROBATE" | "EVICTION" | "PRE_FORECLOSURE" | "AUCTION";

export interface ScrapedContact {
  type: "phone" | "email";
  value: string;
  confidence?: number;     // 0..1
  source?: string;
}

export interface ScrapedProperty {
  sourceKey: string;       // e.g. "zillow-fsbo", "cook-county-probate"
  sourceUrl?: string;
  capturedAt: string;      // ISO
  address: { line1: string; city?: string; state?: string; zip?: string };
  parcelId?: string; 
  apn?: string;
  ownerName?: string;
  attributes?: Record<string, string | number | boolean | null>;
  priceHint?: number;      // if listing/auction
  lastEventDate?: string;  // filing/list/auction date
  distressSignals: DistressSignal[];
  contacts?: ScrapedContact[];
  attachments?: { kind: "img"|"pdf"|"html"; url?: string; sha256?: string }[];
}

export interface ScrapeResult {
  ok: boolean;
  errors?: string[];
  items: ScrapedProperty[];
}
```

### Address and Owner Normalization

```javascript
// src/lib/normalize.js
const crypto = require('crypto');
const postal = require('node-postal'); // libpostal bindings

/**
 * Normalizes an address using libpostal and creates a hash for deduplication
 * @param {string} input - Raw address string
 * @returns {Object} Normalized address info and hash
 */
async function normalizeAddress(input) {
  // Parse with libpostal
  const parsed = postal.parser.parse_address(input);
  
  // Convert to standardized format
  const parts = Object.fromEntries(
    parsed.map(p => [p.component, p.value.toUpperCase()])
  );
  
  // Extract core components
  const line1 = [parts.house_number, parts.road, parts.unit]
    .filter(Boolean)
    .join(" ")
    .trim();
  
  const city = parts.city || parts.town || parts.suburb || "";
  const state = parts.state || "";
  const zip = parts.postcode || "";
  
  // Create normalized string
  const normalized = `${line1}, ${city}, ${state} ${zip}`
    .replace(/\s+/g, " ")
    .trim();
  
  // Create hash for deduplication
  const hash = crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex");
  
  return { 
    normalized, 
    hash, 
    parts: { line1, city, state, zip } 
  };
}

/**
 * Normalizes owner names for consistent matching
 * @param {string} name - Raw owner name
 * @returns {string} Normalized owner name
 */
function normalizeOwnerName(name) {
  if (!name) return null;
  
  // Convert to uppercase
  let normalized = name.toUpperCase();
  
  // Remove common suffixes for individuals
  normalized = normalized
    .replace(/\s+(?:JR|SR|I{1,3}|IV|V)\.?$/g, '')
    .replace(/\s+(?:ESQ|ESQUIRE)\.?$/g, '');
  
  // Handle "ET AL" variations
  normalized = normalized
    .replace(/\s+(?:ET\s+AL|ET\s+UX)\.?$/g, '')
    .replace(/\s+AND\s+OTHERS$/g, '');
  
  // Handle trust wording
  normalized = normalized
    .replace(/\s+(?:TRUST|TRUSTEE|LIVING TRUST|FAMILY TRUST)$/g, '')
    .replace(/\s+(?:REVOCABLE|IRREVOCABLE)$/g, '');
  
  // Handle LLC/Corp/Inc variations
  normalized = normalized
    .replace(/\s+(?:LLC|LC|LLP|LP|INC|INCORPORATED|CORPORATION|CORP)\.?$/g, '')
    .replace(/\s+(?:LIMITED|COMPANY|PARTNERS|PARTNERSHIP)$/g, '');
  
  // Normalize whitespace and punctuation
  normalized = normalized
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
  
  return normalized;
}

module.exports = { normalizeAddress, normalizeOwnerName };
```

### Data Fusion and Deduplication

```javascript
// src/fusion/fuseProperty.js
/**
 * Fuses multiple property records with ATTOM data for a single property
 * @param {Object|null} attom - ATTOM API data
 * @param {Array} items - Array of scraped property items with same addressHash
 * @returns {Object} Fused property record
 */
function fuseRecords(attom, items) {
  // Select base record with most complete information
  const base = pickMostComplete(items);
  
  // Create fused lead record
  const lead = {
    address: base.address,
    addressHash: base.addressHash,
    ownerName: base.ownerName ?? attom?.owner?.owner1?.name ?? null,
    parcelId: attom?.identifier?.obPropId ?? base.parcelId ?? null,
    apn: attom?.identifier?.apn ?? null,
    avm: attom?.avm?.amount?.value ?? null,
    lastSale: attom?.sale?.salesearchdate ?? base.lastEventDate ?? null,
    attributes: { ...base.attributes },
    
    // Combine all distress signals
    distressSignals: Array.from(
      new Set(items.flatMap(i => i.distressSignals))
    ),
    
    // Track all sources
    sources: items.map(i => ({
      key: i.sourceKey,
      url: i.sourceUrl,
      capturedAt: i.capturedAt
    })),
    
    // Track conflicts for auditing
    conflicts: {}
  };
  
  // Merge numeric attributes with preferences
  mergeNumericAttributes(lead, attom, items);
  
  // Merge contacts with highest confidence
  mergeContacts(lead, items);
  
  return lead;
}

/**
 * Selects the most complete record from a set of scraped items
 * @param {Array} items - Array of scraped property items
 * @returns {Object} Most complete property record
 */
function pickMostComplete(items) {
  return items
    .map(i => ({ i, score: completenessScore(i) }))
    .sort((a, b) => b.score - a.score)[0].i;
}

/**
 * Calculates completeness score for a property record
 * @param {Object} item - Scraped property item
 * @returns {number} Completeness score
 */
function completenessScore(item) {
  let score = 0;
  
  // Core property data
  if (item.ownerName) score += 2;
  if (item.parcelId || item.apn) score += 2;
  
  // Property attributes
  const attrs = item.attributes || {};
  if (attrs.bedrooms) score += 1;
  if (attrs.bathrooms) score += 1;
  if (attrs.squareFeet) score += 1;
  if (attrs.yearBuilt) score += 1;
  if (attrs.lotSize) score += 1;
  
  // Financial data
  if (item.priceHint) score += 1;
  if (item.lastEventDate) score += 1;
  
  // Contact info
  if (item.contacts && item.contacts.length) {
    score += item.contacts.length * 2;
  }
  
  return score;
}

/**
 * Merges numeric attributes with source preference
 * @param {Object} lead - Target lead object
 * @param {Object|null} attom - ATTOM data
 * @param {Array} items - Scraped property items
 */
function mergeNumericAttributes(lead, attom, items) {
  // ATTOM is most trusted source for property characteristics
  if (attom?.building?.size?.universalsize) {
    lead.attributes.squareFeet = attom.building.size.universalsize;
    lead.conflicts.squareFeet = { 
      value: attom.building.size.universalsize,
      source: 'attom',
      confidence: 0.95
    };
  }
  
  if (attom?.building?.rooms?.beds) {
    lead.attributes.bedrooms = attom.building.rooms.beds;
    lead.conflicts.bedrooms = { 
      value: attom.building.rooms.beds,
      source: 'attom',
      confidence: 0.95
    };
  }
  
  if (attom?.building?.rooms?.bathstotal) {
    lead.attributes.bathrooms = attom.building.rooms.bathstotal;
    lead.conflicts.bathrooms = { 
      value: attom.building.rooms.bathstotal,
      source: 'attom',
      confidence: 0.95
    };
  }
  
  if (attom?.lot?.lotsize1) {
    lead.attributes.lotSize = attom.lot.lotsize1;
    lead.conflicts.lotSize = { 
      value: attom.lot.lotsize1,
      source: 'attom',
      confidence: 0.95
    };
  }
  
  // For each attribute not covered by ATTOM, use the most frequent value
  const attributes = ['bedrooms', 'bathrooms', 'squareFeet', 'yearBuilt', 'lotSize'];
  
  for (const attr of attributes) {
    if (lead.attributes[attr]) continue; // Already set by ATTOM
    
    // Collect all values for this attribute
    const values = items
      .filter(i => i.attributes && i.attributes[attr] != null)
      .map(i => i.attributes[attr]);
    
    if (values.length === 0) continue;
    
    // Use most common value
    const valueCounts = {};
    values.forEach(v => {
      valueCounts[v] = (valueCounts[v] || 0) + 1;
    });
    
    const mostCommon = Object.entries(valueCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    lead.attributes[attr] = parseFloat(mostCommon[0]);
    lead.conflicts[attr] = {
      value: parseFloat(mostCommon[0]),
      count: mostCommon[1],
      total: values.length,
      confidence: mostCommon[1] / values.length
    };
  }
}

/**
 * Merges contact information with confidence scoring
 * @param {Object} lead - Target lead object
 * @param {Array} items - Scraped property items
 */
function mergeContacts(lead, items) {
  // Collect all contacts
  const contacts = items
    .filter(i => i.contacts && i.contacts.length)
    .flatMap(i => i.contacts);
  
  if (contacts.length === 0) return;
  
  // Group by type and value
  const contactMap = {};
  contacts.forEach(contact => {
    const key = `${contact.type}:${contact.value}`;
    if (!contactMap[key]) {
      contactMap[key] = {
        type: contact.type,
        value: contact.value,
        sources: [],
        confidence: contact.confidence || 0.5
      };
    }
    
    // Track sources
    contactMap[key].sources.push(contact.source || 'unknown');
    
    // Improve confidence if found in multiple sources
    if (contactMap[key].confidence < 0.95) {
      contactMap[key].confidence = Math.min(
        0.95,
        contactMap[key].confidence + 0.15
      );
    }
  });
  
  // Sort by confidence
  lead.contacts = Object.values(contactMap)
    .sort((a, b) => b.confidence - a.confidence);
}

module.exports = { fuseRecords, pickMostComplete, completenessScore };
```

### Lead Scoring System

```javascript
// src/scoring/leadScore.js
/**
 * Scores a lead based on various factors
 * @param {Object} lead - The lead object to score
 * @returns {number} Score from 0-100
 */
function scoreLead(lead) {
  let score = 0;

  // Distress signals (highest weight)
  const signals = new Set(lead.distressSignals || []);
  if (signals.has("PROBATE")) score += 25;
  if (signals.has("CODE_VIOLATION")) score += 15;
  if (signals.has("TAX_DELINQUENT")) score += 15;
  if (signals.has("PRE_FORECLOSURE")) score += 20;
  if (signals.has("AUCTION")) score += 18;
  if (signals.has("FSBO")) score += 10;
  if (signals.has("EVICTION")) score += 12;

  // Equity heuristic
  if (lead.avm && lead.lastSale?.amount) {
    const equity = lead.avm - lead.lastSale.amount;
    const equityPercent = equity / Math.max(lead.avm, 1);
    
    if (equityPercent > 0.5) score += 20;
    else if (equityPercent > 0.3) score += 12;
    else if (equityPercent > 0.15) score += 6;
  }

  // Owner-occupied vs absentee
  const ownerMailingZip = lead.ownerMailingZip || 
    lead.ownerInfo?.mailingAddress?.zip;
  
  if (ownerMailingZip && lead.address?.zip && 
      ownerMailingZip !== lead.address.zip) {
    score += 10; // absentee owner
  }

  // Freshness of data
  if (lead.lastEventDate) {
    const days = (Date.now() - Date.parse(lead.lastEventDate)) / 86400000;
    if (days <= 7) score += 10;
    else if (days <= 30) score += 6;
  }

  // Contact information
  if (lead.contacts && lead.contacts.length) {
    // Higher score if we have both phone and email
    const hasPhone = lead.contacts.some(c => c.type === 'phone');
    const hasEmail = lead.contacts.some(c => c.type === 'email');
    
    if (hasPhone && hasEmail) score += 8;
    else if (hasPhone) score += 5;
    else if (hasEmail) score += 3;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Determines lead temperature based on score
 * @param {number} score - Lead score
 * @returns {string} Temperature category
 */
function temperature(score) {
  if (score >= 80) return "On Fire";
  if (score >= 60) return "Hot";
  if (score >= 35) return "Warm";
  return "Dead";
}

module.exports = { scoreLead, temperature };
```

### Complete Ingestion Pipeline

```javascript
// src/pipeline/runIngestion.js
const { normalizeAddress, normalizeOwnerName } = require('../lib/normalize');
const { fuseRecords } = require('../fusion/fuseProperty');
const { scoreLead, temperature } = require('../scoring/leadScore');
const { upsertLead } = require('../storage/leadsRepo');
const { getAttomByAddress } = require('../attom/attomClient');

/**
 * Process a batch of scraped properties
 * @param {Object} batch - Batch of scraped properties
 */
async function ingestScrapeBatch(batch) {
  if (!batch.ok || !batch.items || !batch.items.length) {
    console.error('Invalid batch format or empty batch');
    return;
  }
  
  console.log(`Processing batch of ${batch.items.length} properties`);
  
  // Normalize addresses and prepare for grouping
  for (const item of batch.items) {
    try {
      // Create address string
      const addrStr = [
        item.address.line1, 
        item.address.city, 
        item.address.state, 
        item.address.zip
      ].filter(Boolean).join(", ");
      
      // Normalize address
      const norm = await normalizeAddress(addrStr);
      item.addressHash = norm.hash;
      item.address.normalized = norm.normalized;
      
      // Normalize owner name if present
      if (item.ownerName) {
        item.normalizedOwnerName = normalizeOwnerName(item.ownerName);
      }
    } catch (error) {
      console.error(`Error normalizing address: ${error.message}`, item.address);
    }
  }
  
  // Group by addressHash
  const byHash = groupBy(batch.items, i => i.addressHash);
  
  // Process each unique property
  const results = [];
  for (const [addressHash, items] of Object.entries(byHash)) {
    try {
      const first = items[0];
      console.log(`Processing property: ${first.address.line1}`);
      
      // Fetch ATTOM data for enrichment
      let attom = null;
      try {
        attom = await getAttomByAddress(first.address);
      } catch (error) {
        console.warn(`ATTOM data fetch failed: ${error.message}`);
      }
      
      // Fuse all records
      const lead = fuseRecords(attom, items);
      
      // Score the lead
      const s = scoreLead(lead);
      lead.leadScore = s;
      lead.temperatureTag = temperature(s);
      lead.addressHash = addressHash;
      
      // Save to database
      await upsertLead(lead);
      results.push({
        addressHash,
        score: s,
        temperature: lead.temperatureTag
      });
    } catch (error) {
      console.error(`Error processing property: ${error.message}`, items[0]);
    }
  }
  
  console.log(`Processed ${results.length} unique properties`);
  return results;
}

/**
 * Groups array items by key function
 * @param {Array} arr - Array to group
 * @param {Function} fn - Key function
 * @returns {Object} Grouped items
 */
function groupBy(arr, fn) {
  return arr.reduce((m, x) => {
    const k = fn(x);
    (m[k] = m[k] || []).push(x);
    return m;
  }, {});
}

module.exports = { ingestScrapeBatch };
```

### API Integration

```javascript
// src/routes/scrapeIntake.js
const express = require('express');
const { ingestScrapeBatch } = require('../pipeline/runIngestion');
const router = express.Router();

/**
 * Endpoint to receive scraped data batches
 */
router.post('/scrape/intake', async (req, res) => {
  try {
    console.log('Received scrape batch');
    
    const batch = req.body;
    if (!batch || !batch.items) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid batch format' 
      });
    }
    
    // Process the batch
    const results = await ingestScrapeBatch(batch);
    
    res.json({ 
      ok: true, 
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('Error processing scrape batch:', error);
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

module.exports = router;
```

## Conclusion

This implementation guide provides the foundation for FlipTracker's data scraping infrastructure. The modular design allows for easy extension to new data sources while maintaining high standards for data quality, error handling, and ethical compliance.

With the upgraded features including Playwright integration for anti-bot hardening, address normalization using libpostal, intelligent data fusion, and lead scoring, the system is ready to deliver high-quality, actionable property data.

For deployment, the Docker and Docker Compose configurations provide a reliable and scalable infrastructure that can be easily deployed to various cloud providers or on-premises servers.

The implementation follows best practices for monitoring, observability, and compliance with website terms of service while maximizing data quality and minimizing false positives.

## 11. Additional County Implementations

### Los Angeles County Scraper

```javascript
// county-scrapers/los-angeles-county-scraper.js
const ScraperBase = require('../scraper-base');
const cheerio = require('cheerio');
const { parseDate, extractCurrency } = require('../utils/parsers');

class LosAngelesCountyScraper extends ScraperBase {
  constructor(config) {
    super({
      ...config,
      useBrowser: true, // LA County site uses JavaScript
      rateLimit: { requestsPerMinute: 8 }
    });
    
    this.baseUrl = 'https://assessor.lacounty.gov';
    this.searchEndpoint = '/online-property-search/';
  }

  async scrape(searchParams) {
    await this.initialize();
    
    try {
      const page = await this.browser.newPage();
      await this.configurePageForScraping(page);

      // Navigate to search page
      await page.goto(`${this.baseUrl}${this.searchEndpoint}`);
      
      // Accept any disclaimer/terms
      try {
        await page.waitForSelector('#disclaimer-accept', { timeout: 5000 });
        await page.click('#disclaimer-accept');
      } catch (e) {
        // No disclaimer present, continue
      }
      
      // Select search by address
      await page.click('#search-by-address-tab');
      
      // Fill search form with address components
      await page.type('#street-number', searchParams.streetNumber);
      await page.type('#street-name', searchParams.streetName);
      await page.select('#city-select', searchParams.city);
      
      // Submit search form
      await page.click('#property-search-button');
      
      // Wait for results or no results message
      await page.waitForSelector('#search-results, #no-results-message', { timeout: 15000 });
      
      // Check if we have results
      const noResultsExists = await page.$('#no-results-message');
      if (noResultsExists) {
        return {
          source: 'los-angeles-county',
          timestamp: new Date(),
          data: null,
          status: 'no_results'
        };
      }
      
      // Check if we have multiple results
      const multipleResults = await page.$$('#search-results .property-result-item');
      
      if (multipleResults.length > 1) {
        // Extract all results
        const resultsHtml = await page.content();
        const summaryResults = this.extractMultiplePropertyResults(resultsHtml);
        
        return {
          source: 'los-angeles-county',
          timestamp: new Date(),
          data: {
            multipleResults: true,
            propertyList: summaryResults
          }
        };
      }
      
      // Single result - click to view details
      await page.click('#search-results .property-result-item a');
      
      // Wait for details page to load
      await page.waitForSelector('#property-detail', { timeout: 15000 });
      
      // Extract detailed property data
      const detailHtml = await page.content();
      const propertyData = this.extractPropertyData(detailHtml);
      
      // Get tax information from separate tab
      await page.click('#tax-tab');
      await page.waitForSelector('#tax-information', { timeout: 10000 });
      
      const taxHtml = await page.content();
      const taxData = this.extractTaxData(taxHtml);
      
      // Combine property and tax data
      const combinedData = {
        ...propertyData,
        taxInfo: taxData
      };
      
      return {
        source: 'los-angeles-county',
        timestamp: new Date(),
        data: combinedData
      };
    } catch (error) {
      console.error('Error scraping Los Angeles County:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  extractMultiplePropertyResults(html) {
    const $ = cheerio.load(html);
    const results = [];
    
    $('#search-results .property-result-item').each((i, el) => {
      const item = $(el);
      
      results.push({
        address: item.find('.property-address').text().trim(),
        ain: item.find('.property-ain').text().trim(),
        propertyType: item.find('.property-type').text().trim(),
        detailUrl: item.find('a').attr('href')
      });
    });
    
    return results;
  }
  
  extractPropertyData(html) {
    const $ = cheerio.load(html);
    
    const propertyData = {
      ain: $('#property-ain').text().trim(),
      address: $('#property-address').text().trim(),
      legalDescription: $('#legal-description').text().trim(),
      propertyType: $('#property-type').text().trim(),
      yearBuilt: this.extractNumber($('#year-built').text()),
      effectiveYearBuilt: this.extractNumber($('#effective-year-built').text()),
      squareFeet: this.extractNumber($('#building-square-footage').text()),
      lotSize: this.extractNumber($('#lot-size-square-feet').text()),
      bedrooms: this.extractNumber($('#bedrooms').text()),
      bathrooms: this.extractNumber($('#bathrooms').text()),
      units: this.extractNumber($('#total-units').text()),
      
      ownerInfo: {
        name: $('#owner-name').text().trim(),
        mailingAddress: $('#mailing-address').text().trim()
      },
      
      lastSale: {
        date: parseDate($('#last-sale-date').text().trim()),
        amount: extractCurrency($('#last-sale-amount').text())
      }
    };
    
    return propertyData;
  }
  
  extractTaxData(html) {
    const $ = cheerio.load(html);
    
    const taxData = {
      taxYear: $('#tax-year').text().trim(),
      landValue: extractCurrency($('#land-value').text()),
      improvementValue: extractCurrency($('#improvement-value').text()),
      totalValue: extractCurrency($('#total-value').text()),
      exemption: extractCurrency($('#exemption-value').text()),
      netTaxableValue: extractCurrency($('#net-taxable-value').text()),
      taxRate: parseFloat($('#tax-rate').text().trim().replace('%', '')) / 100,
      taxAmount: extractCurrency($('#tax-amount').text())
    };
    
    return taxData;
  }
  
  extractNumber(text) {
    const match = text.match(/\d+\.?\d*/);
    return match ? parseFloat(match[0]) : null;
  }
}

module.exports = LosAngelesCountyScraper;
```

### Miami-Dade County Scraper

```javascript
// county-scrapers/miami-dade-county-scraper.js
const ScraperBase = require('../scraper-base');
const cheerio = require('cheerio');
const { parseDate, extractCurrency } = require('../utils/parsers');

class MiamiDadeCountyScraper extends ScraperBase {
  constructor(config) {
    super({
      ...config,
      useBrowser: true,
      rateLimit: { requestsPerMinute: 12 }
    });
    
    this.baseUrl = 'https://www.miamidade.gov';
    this.searchEndpoint = '/pa/property_search.asp';
  }

  async scrape(searchParams) {
    await this.initialize();
    
    try {
      const page = await this.browser.newPage();
      await this.configurePageForScraping(page);

      // Navigate to search page
      await page.goto(`${this.baseUrl}${this.searchEndpoint}`);
      
      // Wait for search form to load
      await page.waitForSelector('#search-form');
      
      // Determine search method based on params
      if (searchParams.folio) {
        await this.searchByFolio(page, searchParams.folio);
      } else if (searchParams.address) {
        await this.searchByAddress(page, searchParams);
      } else if (searchParams.owner) {
        await this.searchByOwnerName(page, searchParams.owner);
      } else {
        throw new Error('Search parameters must include folio, address, or owner');
      }
      
      // Wait for results page
      await page.waitForSelector('#search-results, #property-details, #no-results', { timeout: 15000 });
      
      // Check for no results
      const noResultsExists = await page.$('#no-results');
      if (noResultsExists) {
        return {
          source: 'miami-dade-county',
          timestamp: new Date(),
          data: null,
          status: 'no_results'
        };
      }
      
      // Check if we have multiple results or direct property details
      const searchResultsExists = await page.$('#search-results');
      
      if (searchResultsExists) {
        // Extract multiple results
        const resultsHtml = await page.content();
        const summaryResults = this.extractMultiplePropertyResults(resultsHtml);
        
        // If only one result, get its details
        if (summaryResults.length === 1) {
          await page.click('#search-results .property-result a');
          await page.waitForSelector('#property-details', { timeout: 15000 });
        } else {
          return {
            source: 'miami-dade-county',
            timestamp: new Date(),
            data: {
              multipleResults: true,
              propertyList: summaryResults
            }
          };
        }
      }
      
      // We now have a single property detail page open
      
      // Get property details
      const detailHtml = await page.content();
      const propertyData = this.extractPropertyData(detailHtml);
      
      // Navigate to tax tab
      await page.click('#tax-information-tab');
      await page.waitForSelector('#tax-details', { timeout: 10000 });
      
      const taxHtml = await page.content();
      const taxData = this.extractTaxData(taxHtml);
      
      // Navigate to sales tab
      await page.click('#sales-information-tab');
      await page.waitForSelector('#sales-history', { timeout: 10000 });
      
      const salesHtml = await page.content();
      const salesData = this.extractSalesData(salesHtml);
      
      // Combine all data
      const combinedData = {
        ...propertyData,
        taxInfo: taxData,
        salesHistory: salesData
      };
      
      return {
        source: 'miami-dade-county',
        timestamp: new Date(),
        data: combinedData
      };
    } catch (error) {
      console.error('Error scraping Miami-Dade County:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  async searchByFolio(page, folio) {
    await page.click('#folio-search-tab');
    await page.type('#folio-number', folio);
    await page.click('#search-button');
  }
  
  async searchByAddress(page, searchParams) {
    await page.click('#address-search-tab');
    
    if (searchParams.streetNumber) {
      await page.type('#street-number', searchParams.streetNumber);
    }
    
    await page.type('#street-name', searchParams.streetName);
    
    if (searchParams.unit) {
      await page.type('#unit', searchParams.unit);
    }
    
    await page.click('#search-button');
  }
  
  async searchByOwnerName(page, ownerName) {
    await page.click('#owner-search-tab');
    await page.type('#owner-name', ownerName);
    await page.click('#search-button');
  }
  
  extractMultiplePropertyResults(html) {
    const $ = cheerio.load(html);
    const results = [];
    
    $('.property-result').each((i, el) => {
      const item = $(el);
      
      results.push({
        folio: item.find('.folio-number').text().trim(),
        address: item.find('.property-address').text().trim(),
        owner: item.find('.owner-name').text().trim(),
        propertyType: item.find('.property-type').text().trim(),
        detailUrl: item.find('a').attr('href')
      });
    });
    
    return results;
  }
  
  extractPropertyData(html) {
    const $ = cheerio.load(html);
    
    const propertyData = {
      folio: $('#folio-number').text().trim(),
      address: $('#property-address').text().trim(),
      legalDescription: $('#legal-description').text().trim(),
      propertyUse: $('#property-use').text().trim(),
      totalLivingArea: this.extractNumber($('#total-living-area').text()),
      lotSize: this.extractNumber($('#lot-size').text()),
      bedrooms: this.extractNumber($('#bedrooms').text()),
      bathrooms: this.extractNumber($('#bathrooms').text()),
      stories: this.extractNumber($('#stories').text()),
      yearBuilt: this.extractNumber($('#year-built').text()),
      
      ownerInfo: {
        name: $('#owner-name').text().trim(),
        mailingAddress: $('#mailing-address').text().trim()
      }
    };
    
    return propertyData;
  }
  
  extractTaxData(html) {
    const $ = cheerio.load(html);
    
    const taxData = {
      taxYear: $('#tax-year').text().trim(),
      assessedValue: extractCurrency($('#assessed-value').text()),
      exemptionValue: extractCurrency($('#exemption-value').text()),
      taxableValue: extractCurrency($('#taxable-value').text()),
      millageRate: parseFloat($('#millage-rate').text().replace('mills', '').trim()),
      taxAmount: extractCurrency($('#tax-amount').text()),
      taxStatus: $('#tax-status').text().trim()
    };
    
    return taxData;
  }
  
  extractSalesData(html) {
    const $ = cheerio.load(html);
    const salesHistory = [];
    
    $('#sales-table tr:not(:first-child)').each((i, el) => {
      const row = $(el);
      const columns = row.find('td');
      
      salesHistory.push({
        date: parseDate($(columns[0]).text().trim()),
        price: extractCurrency($(columns[1]).text()),
        qualificationDescription: $(columns[2]).text().trim(),
        deedType: $(columns[3]).text().trim(),
        bookPage: $(columns[4]).text().trim()
      });
    });
    
    return salesHistory;
  }
  
  extractNumber(text) {
    const match = text.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }
}

module.exports = MiamiDadeCountyScraper;
```

## 12. Auction and Foreclosure Site Implementations

### Auction.com Scraper

```javascript
// auction-scrapers/auction-com-scraper.js
const ScraperBase = require('../scraper-base');
const cheerio = require('cheerio');
const { parseDate, extractCurrency } = require('../utils/parsers');

class AuctionComScraper extends ScraperBase {
  constructor(config) {
    super({
      ...config,
      useBrowser: true,
      rateLimit: { requestsPerMinute: 6 }
    });
    
    this.baseUrl = 'https://www.auction.com';
    this.searchEndpoint = '/search';
  }

  async scrape(searchParams) {
    await this.initialize();
    
    try {
      const page = await this.browser.newPage();
      await this.configurePageForScraping(page);
      
      // Set cookie consent if needed
      await this.handleCookieConsent(page);
      
      // Navigate to search page
      let searchUrl = `${this.baseUrl}${this.searchEndpoint}`;
      
      // Build query parameters based on search params
      const queryParams = [];
      
      if (searchParams.state) {
        queryParams.push(`state=${searchParams.state}`);
      }
      
      if (searchParams.county) {
        queryParams.push(`county=${searchParams.county}`);
      }
      
      if (searchParams.city) {
        queryParams.push(`city=${encodeURIComponent(searchParams.city)}`);
      }
      
      if (searchParams.zip) {
        queryParams.push(`zip=${searchParams.zip}`);
      }
      
      if (searchParams.radius) {
        queryParams.push(`radius=${searchParams.radius}`);
      }
      
      if (searchParams.propertyType) {
        queryParams.push(`propertyTypes=${searchParams.propertyType}`);
      }
      
      if (searchParams.auctionType) {
        queryParams.push(`auctionType=${searchParams.auctionType}`);
      }
      
      if (queryParams.length > 0) {
        searchUrl += '?' + queryParams.join('&');
      }
      
      await page.goto(searchUrl);
      
      // Wait for search results to load
      await page.waitForSelector('.search-results, .no-results', { timeout: 20000 });
      
      // Check if we have results
      const noResultsExists = await page.$('.no-results');
      if (noResultsExists) {
        return {
          source: 'auction-com',
          timestamp: new Date(),
          data: {
            totalResults: 0,
            properties: []
          },
          searchParams
        };
      }
      
      // Get total results count
      const totalResultsText = await page.$eval('.result-count', el => el.textContent);
      const totalResults = parseInt(totalResultsText.match(/\d+/)[0], 10);
      
      // Extract property listings from first page
      let properties = await this.extractPropertyListings(page);
      
      // Limit number of pages to scrape (to avoid excessive requests)
      const maxPages = 3;
      let currentPage = 1;
      
      // Check if there are more pages and scrape them
      while (currentPage < maxPages) {
        const nextPageButton = await page.$('.pagination .next:not(.disabled)');
        
        if (!nextPageButton) {
          break;
        }
        
        // Go to next page
        await nextPageButton.click();
        
        // Wait for results to load
        await page.waitForSelector('.search-results', { timeout: 20000 });
        
        // Extract property listings from this page
        const pageProperties = await this.extractPropertyListings(page);
        properties = [...properties, ...pageProperties];
        
        currentPage++;
      }
      
      return {
        source: 'auction-com',
        timestamp: new Date(),
        data: {
          totalResults,
          properties
        },
        searchParams
      };
    } catch (error) {
      console.error('Error scraping Auction.com:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  async handleCookieConsent(page) {
    try {
      await page.goto(this.baseUrl);
      
      // Wait for and click cookie consent if it appears
      const cookieConsentSelector = '.cookie-consent-accept';
      await page.waitForSelector(cookieConsentSelector, { timeout: 5000 });
      await page.click(cookieConsentSelector);
      
      // Wait a moment for the consent to be processed
      await page.waitForTimeout(1000);
    } catch (e) {
      // Cookie consent dialog may not appear, continue
      console.log('No cookie consent dialog found, continuing...');
    }
  }
  
  async extractPropertyListings(page) {
    // Get the HTML content
    const html = await page.content();
    const $ = cheerio.load(html);
    
    const properties = [];
    
    $('.property-card').each((i, el) => {
      const card = $(el);
      const property = {
        propertyId: card.attr('data-property-id'),
        address: card.find('.property-address').text().trim(),
        city: card.find('.property-city').text().trim(),
        state: card.find('.property-state').text().trim(),
        zip: card.find('.property-zip').text().trim(),
        
        propertyType: card.find('.property-type').text().trim(),
        bedrooms: this.extractNumber(card.find('.bedrooms').text()),
        bathrooms: this.extractNumber(card.find('.bathrooms').text()),
        squareFeet: this.extractNumber(card.find('.square-feet').text()),
        
        auctionDate: parseDate(card.find('.auction-date').text().trim()),
        auctionType: card.find('.auction-type').text().trim(),
        
        startingBid: extractCurrency(card.find('.starting-bid').text()),
        estimatedValue: extractCurrency(card.find('.estimated-value').text()),
        
        status: card.find('.status').text().trim(),
        detailUrl: this.baseUrl + card.find('a.property-link').attr('href')
      };
      
      properties.push(property);
    });
    
    return properties;
  }
  
  async getPropertyDetails(propertyId) {
    await this.initialize();
    
    try {
      const page = await this.browser.newPage();
      await this.configurePageForScraping(page);
      
      // Navigate to property detail page
      await page.goto(`${this.baseUrl}/details/${propertyId}`);
      
      // Wait for property details to load
      await page.waitForSelector('.property-details', { timeout: 15000 });
      
      // Extract detailed property information
      const html = await page.content();
      const detailedInfo = this.extractDetailedPropertyInfo(html);
      
      return {
        source: 'auction-com',
        timestamp: new Date(),
        data: detailedInfo
      };
    } catch (error) {
      console.error(`Error getting property details for ${propertyId}:`, error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  extractDetailedPropertyInfo(html) {
    const $ = cheerio.load(html);
    
    const detailedInfo = {
      propertyId: $('.property-id').text().trim(),
      address: $('.property-address').text().trim(),
      city: $('.property-city').text().trim(),
      state: $('.property-state').text().trim(),
      zip: $('.property-zip').text().trim(),
      
      propertyType: $('.property-type').text().trim(),
      bedrooms: this.extractNumber($('.bedrooms').text()),
      bathrooms: this.extractNumber($('.bathrooms').text()),
      squareFeet: this.extractNumber($('.square-feet').text()),
      lotSize: this.extractNumber($('.lot-size').text()),
      yearBuilt: this.extractNumber($('.year-built').text()),
      
      auctionInfo: {
        auctionDate: parseDate($('.auction-date').text().trim()),
        auctionTime: $('.auction-time').text().trim(),
        auctionType: $('.auction-type').text().trim(),
        auctionLocation: $('.auction-location').text().trim(),
        startingBid: extractCurrency($('.starting-bid').text()),
        currentBid: extractCurrency($('.current-bid').text()),
        estimatedValue: extractCurrency($('.estimated-value').text()),
        depositRequired: extractCurrency($('.deposit-required').text()),
        depositDueDate: parseDate($('.deposit-due-date').text().trim())
      },
      
      occupancyStatus: $('.occupancy-status').text().trim(),
      propertyCondition: $('.property-condition').text().trim(),
      
      taxInformation: {
        taxId: $('.tax-id').text().trim(),
        taxAssessedValue: extractCurrency($('.tax-assessed-value').text()),
        taxAmount: extractCurrency($('.tax-amount').text()),
        taxYear: $('.tax-year').text().trim()
      },
      
      legalDescription: $('.legal-description').text().trim(),
      
      foreclosureInfo: {
        caseNumber: $('.case-number').text().trim(),
        filingDate: parseDate($('.filing-date').text().trim()),
        originalLoanAmount: extractCurrency($('.original-loan-amount').text()),
        loanDate: parseDate($('.loan-date').text().trim()),
        lender: $('.lender').text().trim()
      },
      
      nearbyComparableSales: this.extractComparableSales($)
    };
    
    return detailedInfo;
  }
  
  extractComparableSales($) {
    const comparables = [];
    
    $('.comparable-sale').each((i, el) => {
      const comp = $(el);
      
      comparables.push({
        address: comp.find('.comparable-address').text().trim(),
        saleDate: parseDate(comp.find('.comparable-sale-date').text().trim()),
        salePrice: extractCurrency(comp.find('.comparable-sale-price').text()),
        distance: comp.find('.comparable-distance').text().trim(),
        bedrooms: this.extractNumber(comp.find('.comparable-bedrooms').text()),
        bathrooms: this.extractNumber(comp.find('.comparable-bathrooms').text()),
        squareFeet: this.extractNumber(comp.find('.comparable-square-feet').text()),
        yearBuilt: this.extractNumber(comp.find('.comparable-year-built').text())
      });
    });
    
    return comparables;
  }
  
  extractNumber(text) {
    const match = text.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }
}

module.exports = AuctionComScraper;
```

### Hubzu.com Scraper

```javascript
// auction-scrapers/hubzu-scraper.js
const ScraperBase = require('../scraper-base');
const cheerio = require('cheerio');
const { parseDate, extractCurrency } = require('../utils/parsers');

class HubzuScraper extends ScraperBase {
  constructor(config) {
    super({
      ...config,
      useBrowser: true,
      rateLimit: { requestsPerMinute: 5 }
    });
    
    this.baseUrl = 'https://www.hubzu.com';
    this.searchEndpoint = '/search';
  }

  async scrape(searchParams) {
    await this.initialize();
    
    try {
      const page = await this.browser.newPage();
      await this.configurePageForScraping(page);
      
      // Navigate to search page
      await page.goto(`${this.baseUrl}${this.searchEndpoint}`);
      
      // Handle any interstitials or popups
      await this.handleInterstitials(page);
      
      // Apply search filters
      await this.applySearchFilters(page, searchParams);
      
      // Wait for results to load
      await page.waitForSelector('.property-results, .no-results', { timeout: 20000 });
      
      // Check if we have results
      const noResultsExists = await page.$('.no-results');
      if (noResultsExists) {
        return {
          source: 'hubzu',
          timestamp: new Date(),
          data: {
            totalResults: 0,
            properties: []
          },
          searchParams
        };
      }
      
      // Get total results count
      let totalResultsText;
      try {
        totalResultsText = await page.$eval('.results-count', el => el.textContent);
      } catch (e) {
        totalResultsText = '0';
      }
      
      const totalResultsMatch = totalResultsText.match(/\d+/);
      const totalResults = totalResultsMatch ? parseInt(totalResultsMatch[0], 10) : 0;
      
      // Extract property listings
      let properties = await this.extractPropertyListings(page);
      
      // Determine how many pages to scrape (max 3)
      const maxPages = Math.min(3, Math.ceil(totalResults / 24)); // Assuming 24 per page
      let currentPage = 1;
      
      while (currentPage < maxPages) {
        // Check for next page button
        const nextPageButton = await page.$('.pagination-next:not(.disabled)');
        if (!nextPageButton) {
          break;
        }
        
        // Go to next page
        await nextPageButton.click();
        
        // Wait for results to load
        await page.waitForSelector('.property-results', { timeout: 15000 });
        
        // Extract property listings from this page
        const pageProperties = await this.extractPropertyListings(page);
        properties = [...properties, ...pageProperties];
        
        currentPage++;
      }
      
      return {
        source: 'hubzu',
        timestamp: new Date(),
        data: {
          totalResults,
          properties
        },
        searchParams
      };
    } catch (error) {
      console.error('Error scraping Hubzu:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  async handleInterstitials(page) {
    try {
      // Wait for potential popup/interstitial
      await page.waitForSelector('.popup-close, .modal-close, .interstitial-close', { timeout: 5000 });
      
      // Close popup if it exists
      await page.click('.popup-close, .modal-close, .interstitial-close');
      
      // Wait a moment for the popup to close
      await page.waitForTimeout(1000);
    } catch (e) {
      // No popup appeared, continue
    }
  }
  
  async applySearchFilters(page, searchParams) {
    // Location search
    if (searchParams.location) {
      await page.type('#location-search', searchParams.location);
      await page.click('#search-button');
      
      // Wait for results to update
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    }
    
    // Open filters panel if needed
    const filtersButton = await page.$('#filters-button');
    if (filtersButton) {
      await filtersButton.click();
      await page.waitForSelector('#filters-panel', { visible: true, timeout: 5000 });
    }
    
    // Apply price range
    if (searchParams.minPrice) {
      await page.type('#min-price', searchParams.minPrice.toString());
    }
    
    if (searchParams.maxPrice) {
      await page.type('#max-price', searchParams.maxPrice.toString());
    }
    
    // Apply property type filter
    if (searchParams.propertyType) {
      const propertyTypeCheckbox = await page.$(`#property-type-${searchParams.propertyType.toLowerCase()}`);
      if (propertyTypeCheckbox) {
        await propertyTypeCheckbox.click();
      }
    }
    
    // Apply auction type filter
    if (searchParams.auctionType) {
      const auctionTypeCheckbox = await page.$(`#auction-type-${searchParams.auctionType.toLowerCase()}`);
      if (auctionTypeCheckbox) {
        await auctionTypeCheckbox.click();
      }
    }
    
    // Apply bedrooms filter
    if (searchParams.minBedrooms) {
      await page.select('#min-bedrooms', searchParams.minBedrooms.toString());
    }
    
    // Apply bathrooms filter
    if (searchParams.minBathrooms) {
      await page.select('#min-bathrooms', searchParams.minBathrooms.toString());
    }
    
    // Apply filters
    const applyFiltersButton = await page.$('#apply-filters');
    if (applyFiltersButton) {
      await applyFiltersButton.click();
      
      // Wait for results to update
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    }
  }
  
  async extractPropertyListings(page) {
    const html = await page.content();
    const $ = cheerio.load(html);
    
    const properties = [];
    
    $('.property-card').each((i, el) => {
      const card = $(el);
      
      const property = {
        propertyId: card.attr('data-property-id'),
        address: card.find('.property-address').text().trim(),
        city: card.find('.property-city').text().trim(),
        state: card.find('.property-state').text().trim(),
        zip: card.find('.property-zip').text().trim(),
        
        propertyType: card.find('.property-type').text().trim(),
        bedrooms: this.extractNumber(card.find('.bedrooms').text()),
        bathrooms: this.extractNumber(card.find('.bathrooms').text()),
        squareFeet: this.extractNumber(card.find('.square-feet').text()),
        
        auctionInfo: {
          auctionStatus: card.find('.auction-status').text().trim(),
          auctionEndDate: parseDate(card.find('.auction-end-date').text().trim()),
          startingBid: extractCurrency(card.find('.starting-bid').text()),
          currentBid: extractCurrency(card.find('.current-bid').text()),
          numberOfBids: parseInt(card.find('.bid-count').text().replace('bids', '').trim(), 10) || 0,
          reserveStatus: card.find('.reserve-status').text().trim()
        },
        
        estimatedValue: extractCurrency(card.find('.estimated-value').text()),
        detailUrl: card.find('a.property-link').attr('href')
      };
      
      properties.push(property);
    });
    
    return properties;
  }
  
  async getPropertyDetails(propertyId) {
    await this.initialize();
    
    try {
      const page = await this.browser.newPage();
      await this.configurePageForScraping(page);
      
      // Navigate to property detail page
      await page.goto(`${this.baseUrl}/property/${propertyId}`);
      
      // Handle any interstitials
      await this.handleInterstitials(page);
      
      // Wait for property details to load
      await page.waitForSelector('.property-details', { timeout: 15000 });
      
      // Extract detailed property information
      const html = await page.content();
      const detailedInfo = this.extractDetailedPropertyInfo(html);
      
      return {
        source: 'hubzu',
        timestamp: new Date(),
        data: detailedInfo
      };
    } catch (error) {
      console.error(`Error getting property details for ${propertyId}:`, error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  extractDetailedPropertyInfo(html) {
    const $ = cheerio.load(html);
    
    const detailedInfo = {
      propertyId: $('.property-id').text().trim(),
      address: $('.property-address').text().trim(),
      city: $('.property-city').text().trim(),
      state: $('.property-state').text().trim(),
      zip: $('.property-zip').text().trim(),
      
      propertyType: $('.property-type').text().trim(),
      bedrooms: this.extractNumber($('.bedrooms').text()),
      bathrooms: this.extractNumber($('.bathrooms').text()),
      squareFeet: this.extractNumber($('.square-feet').text()),
      lotSize: this.extractNumber($('.lot-size').text()),
      yearBuilt: this.extractNumber($('.year-built').text()),
      
      auctionInfo: {
        auctionStatus: $('.auction-status').text().trim(),
        auctionEndDate: parseDate($('.auction-end-date').text().trim()),
        startingBid: extractCurrency($('.starting-bid').text()),
        currentBid: extractCurrency($('.current-bid').text()),
        numberOfBids: parseInt($('.bid-count').text().replace('bids', '').trim(), 10) || 0,
        reserveStatus: $('.reserve-status').text().trim(),
        depositAmount: extractCurrency($('.deposit-amount').text())
      },
      
      propertyDescription: $('.property-description').text().trim(),
      
      propertyFeatures: this.extractPropertyFeatures($),
      
      propertyCondition: $('.property-condition').text().trim(),
      occupancyStatus: $('.occupancy-status').text().trim(),
      
      taxInformation: {
        taxId: $('.tax-id').text().trim(),
        taxYear: $('.tax-year').text().trim(),
        taxAmount: extractCurrency($('.tax-amount').text()),
        taxAssessedValue: extractCurrency($('.tax-assessed-value').text())
      },
      
      propertyHistory: this.extractPropertyHistory($),
      
      titleInformation: {
        titleCompany: $('.title-company').text().trim(),
        titleStatus: $('.title-status').text().trim()
      }
    };
    
    return detailedInfo;
  }
  
  extractPropertyFeatures($) {
    const features = {};
    
    $('.property-features li').each((i, el) => {
      const feature = $(el).text().trim();
      const separatorIndex = feature.indexOf(':');
      
      if (separatorIndex !== -1) {
        const key = feature.substring(0, separatorIndex).trim();
        const value = feature.substring(separatorIndex + 1).trim();
        features[key] = value;
      }
    });
    
    return features;
  }
  
  extractPropertyHistory($) {
    const history = [];
    
    $('.property-history tbody tr').each((i, el) => {
      const row = $(el);
      const cells = row.find('td');
      
      history.push({
        date: parseDate($(cells[0]).text().trim()),
        event: $(cells[1]).text().trim(),
        price: extractCurrency($(cells[2]).text())
      });
    });
    
    return history;
  }
  
  extractNumber(text) {
    const match = text.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }
}

module.exports = HubzuScraper;
```

## Next Steps

1. Implement the remaining specific county-level scrapers based on the provided base classes
2. Set up the data enrichment pipelines using the property data processor
3. Configure monitoring and alerting for scraper health
4. Develop the frontend components to display and interact with the scraped data
5. Implement automated testing and validation for scraped data
6. Set up deployment pipelines for continuous integration

## Resources

- [Puppeteer Documentation](https://pptr.dev/)
- [Cheerio Documentation](https://cheerio.js.org/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Property Data Standards Guide](https://www.reso.org/data-dictionary/)
- [Real Estate API Design Patterns](https://developers.realtor.com/docs/)

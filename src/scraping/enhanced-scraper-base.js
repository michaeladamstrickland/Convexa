/**
 * enhanced-scraper-base.js
 * Enhanced version of ScraperBase that outputs standardized ScrapeResult objects
 */
const ScraperBase = require('../../scraper-base');
const { normalizeAddress } = require('../lib/normalize');

class EnhancedScraperBase extends ScraperBase {
  constructor(config) {
    super(config);
    this.sourceKey = config.sourceKey || 'unknown-source';
  }

  /**
   * Standardizes output format from original scrapers
   * @param {Object} originalData - Original data from scraper
   * @returns {Object} Standardized ScrapeResult object
   */
  async standardizeOutput(originalData, searchParams = {}) {
    if (!originalData || !originalData.data) {
      return {
        ok: false,
        errors: ['No data returned from scraper'],
        items: []
      };
    }
    
    // Start time (to be overwritten if in original data)
    const startTime = new Date().toISOString();
    
    try {
      // Handle both array and single object formats
      const dataArray = Array.isArray(originalData.data) 
        ? originalData.data 
        : [originalData.data];
      
      // Transform each data item
      const items = await Promise.all(
        dataArray.map(async (item) => {
          // Get address components
          let address = { line1: 'Unknown' };
          
          // Extract address from various formats
          if (item.address) {
            if (typeof item.address === 'string') {
              // Handle string address
              address.line1 = item.address;
              address.city = item.city || searchParams.city;
              address.state = item.state || searchParams.state;
              address.zip = item.zipCode || item.zip || searchParams.zip;
            } else {
              // Handle object address
              address = {
                line1: item.address.street || item.address.line1 || 'Unknown',
                city: item.address.city,
                state: item.address.state,
                zip: item.address.zipCode || item.address.zip
              };
            }
          }
          
          // Normalize the address
          const addrString = [
            address.line1, 
            address.city, 
            address.state, 
            address.zip
          ].filter(Boolean).join(', ');
          
          const normalized = await normalizeAddress(addrString);
          
          // Map property attributes
          const attributes = {};
          
          // Extract common property details
          if (item.propertyDetails || item.characteristics) {
            const details = item.propertyDetails || item.characteristics || {};
            attributes.propertyType = details.propertyType;
            attributes.bedrooms = details.bedrooms;
            attributes.bathrooms = details.bathrooms;
            attributes.squareFeet = details.squareFeet;
            attributes.lotSize = details.lotSize;
            attributes.yearBuilt = details.yearBuilt;
            attributes.stories = details.stories;
          }
          
          // Extract owner information
          let ownerName = null;
          if (item.owner) {
            ownerName = typeof item.owner === 'string' 
              ? item.owner 
              : item.owner.name || item.ownerName;
          } else if (item.ownerName) {
            ownerName = item.ownerName;
          } else if (item.ownerInfo && item.ownerInfo.name) {
            ownerName = item.ownerInfo.name;
          }
          
          // Determine distress signals
          const distressSignals = [];
          
          // Auction detection
          if (item.auctionDate || (item.auctionInfo && item.auctionInfo.auctionDate)) {
            distressSignals.push("AUCTION");
          }
          
          // Foreclosure detection
          if (
            (item.foreclosureInfo) || 
            (item.status && item.status.toLowerCase().includes('foreclosure')) ||
            (originalData.source && originalData.source.toLowerCase().includes('foreclosure'))
          ) {
            distressSignals.push("PRE_FORECLOSURE");
          }
          
          // Tax delinquency detection
          if (
            (item.taxInfo && item.taxInfo.status && 
             item.taxInfo.status.toLowerCase().includes('delinquent')) ||
            (item.taxStatus && item.taxStatus.toLowerCase().includes('delinquent'))
          ) {
            distressSignals.push("TAX_DELINQUENT");
          }
          
          // Create standardized property object
          const standardizedItem = {
            sourceKey: this.sourceKey,
            sourceUrl: item.detailUrl || item.url,
            capturedAt: originalData.timestamp || new Date().toISOString(),
            
            address: {
              line1: address.line1,
              city: address.city,
              state: address.state,
              zip: address.zip
            },
            
            parcelId: item.pin || item.parcelId || item.folio,
            apn: item.apn,
            ownerName,
            
            attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
            
            priceHint: item.estimatedValue || 
                      (item.lastSale ? item.lastSale.amount : null) ||
                      (item.taxInfo ? item.taxInfo.assessedValue : null),
                      
            lastEventDate: (item.lastSale ? item.lastSale.date : null) ||
                          item.auctionDate ||
                          (item.auctionInfo ? item.auctionInfo.auctionDate : null),
            
            distressSignals,
            
            // Add contacts if available
            contacts: this.extractContacts(item),
            
            // Add attachments if available
            attachments: this.extractAttachments(item)
          };
          
          return standardizedItem;
        })
      );
      
      return {
        ok: true,
        errors: [],
        items,
        scraperId: this.sourceKey,
        scrapeStartTime: originalData.startTime || startTime,
        scrapeEndTime: new Date().toISOString(),
        totalPagesProcessed: originalData.pagesProcessed || 1
      };
    } catch (error) {
      return {
        ok: false,
        errors: [error.message],
        items: [],
        scraperId: this.sourceKey,
        scrapeStartTime: startTime,
        scrapeEndTime: new Date().toISOString()
      };
    }
  }
  
  /**
   * Extract contact information from property data
   * @param {Object} item - Property data
   * @returns {Array} Standardized contacts
   */
  extractContacts(item) {
    const contacts = [];
    
    // Extract phone numbers
    if (item.phone || (item.ownerInfo && item.ownerInfo.phone)) {
      contacts.push({
        type: 'phone',
        value: item.phone || item.ownerInfo.phone,
        confidence: 0.8,
        source: this.sourceKey
      });
    }
    
    // Extract email addresses
    if (item.email || (item.ownerInfo && item.ownerInfo.email)) {
      contacts.push({
        type: 'email',
        value: item.email || item.ownerInfo.email,
        confidence: 0.8,
        source: this.sourceKey
      });
    }
    
    // Extract contact information from listing agent if present
    if (item.listingAgent) {
      if (item.listingAgent.phone) {
        contacts.push({
          type: 'phone',
          value: item.listingAgent.phone,
          confidence: 0.6,
          source: `${this.sourceKey}-agent`
        });
      }
      
      if (item.listingAgent.email) {
        contacts.push({
          type: 'email',
          value: item.listingAgent.email,
          confidence: 0.6,
          source: `${this.sourceKey}-agent`
        });
      }
    }
    
    return contacts.length > 0 ? contacts : undefined;
  }
  
  /**
   * Extract attachments from property data
   * @param {Object} item - Property data
   * @returns {Array} Standardized attachments
   */
  extractAttachments(item) {
    const attachments = [];
    
    // Extract images
    if (item.images && Array.isArray(item.images)) {
      item.images.forEach(img => {
        attachments.push({
          kind: 'img',
          url: img.url || img
        });
      });
    } else if (item.imageUrl) {
      attachments.push({
        kind: 'img',
        url: item.imageUrl
      });
    }
    
    // Extract documents
    if (item.documents && Array.isArray(item.documents)) {
      item.documents.forEach(doc => {
        attachments.push({
          kind: doc.kind || 'pdf',
          url: doc.url
        });
      });
    }
    
    return attachments.length > 0 ? attachments : undefined;
  }
  
  /**
   * Override the scrape method to standardize output
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Standardized ScrapeResult
   */
  async scrape(searchParams) {
    // Call the original scrape method
    const startTime = new Date().toISOString();
    
    try {
      const originalResult = await super.scrape(searchParams);
      originalResult.startTime = startTime;
      
      // Standardize the output
      return await this.standardizeOutput(originalResult, searchParams);
    } catch (error) {
      return {
        ok: false,
        errors: [error.message],
        items: [],
        scraperId: this.sourceKey,
        scrapeStartTime: startTime,
        scrapeEndTime: new Date().toISOString()
      };
    }
  }
}

module.exports = EnhancedScraperBase;

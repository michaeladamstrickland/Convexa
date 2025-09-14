/**
 * cook-county-enhanced.js
 * Enhanced version of the Cook County scraper that outputs standardized data
 */
const EnhancedScraperBase = require('../scraping/enhanced-scraper-base');
const cheerio = require('cheerio');

class EnhancedCookCountyScraper extends EnhancedScraperBase {
  constructor(config = {}) {
    super({
      ...config,
      useBrowser: true,
      rateLimit: { requestsPerMinute: 10 },
      sourceKey: 'cook-county'
    });
    
    this.baseUrl = 'https://cookcountypropertyinfo.com';
    this.searchEndpoint = '/search';
  }

  // The original scrape method can remain unchanged
  // EnhancedScraperBase.scrape will call it and standardize the output

  // We can enhance the extractData method to include more fields
  async extractData(html) {
    const $ = cheerio.load(html);
    
    // Extract property data with additional fields
    const propertyData = {
      pin: $('.pin-number').text().trim(),
      address: $('.property-address').text().trim(),
      owner: $('.owner-name').text().trim(),
      taxInfo: {
        assessedValue: this.extractCurrency($('.assessed-value').text()),
        taxAmount: this.extractCurrency($('.tax-amount').text()),
        taxYear: $('.tax-year').text().trim(),
        taxStatus: $('.tax-status').text().trim()
      },
      propertyDetails: {
        propertyType: $('.property-type').text().trim(),
        squareFeet: this.extractNumber($('.square-feet').text()),
        bedrooms: this.extractNumber($('.bedrooms').text()),
        bathrooms: this.extractNumber($('.bathrooms').text()),
        yearBuilt: this.extractNumber($('.year-built').text()),
        lotSize: this.extractNumber($('.lot-size').text())
      },
      lastSale: {
        date: $('.sale-date').text().trim(),
        amount: this.extractCurrency($('.sale-amount').text()),
        buyerName: $('.buyer-name').text().trim(),
        sellerName: $('.seller-name').text().trim()
      },
      // Additional fields for distress signals
      taxStatus: $('.tax-status').text().trim(),
      foreclosureStatus: $('.foreclosure-status').text().trim(),
      ownerInfo: {
        name: $('.owner-name').text().trim(),
        mailingAddress: {
          street: $('.owner-mailing-street').text().trim(),
          city: $('.owner-mailing-city').text().trim(),
          state: $('.owner-mailing-state').text().trim(),
          zip: $('.owner-mailing-zip').text().trim()
        },
        phone: $('.owner-phone').text().trim(),
        email: $('.owner-email').text().trim()
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

module.exports = EnhancedCookCountyScraper;

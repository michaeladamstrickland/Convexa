/**
 * zillow-scraper.cjs
 * Playwright-based scraper for Zillow property data
 */

const PlaywrightScraperBase = require('./playwright-scraper-base.cjs');
const { normalizeAddress } = require('../lib/normalize.cjs');

class ZillowScraper extends PlaywrightScraperBase {
  constructor(config = {}) {
    super({
      headless: true,
      stealthMode: true,
      screenshots: true,
      screenshotDir: './screenshots/zillow',
      ...config
    });
    
    this.baseUrl = 'https://www.zillow.com';
    this.source = 'ZILLOW';
  }
  
  /**
   * Search for properties by address
   */
  async searchByAddress(address) {
    try {
      // Initialize browser if needed
      if (!this.browser) {
        await this.initialize();
      }
      
      // Create a new page
      const page = await this.newPage();
      
      // Navigate to Zillow
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle'
      });
      
      // Wait for search input and enter address
      const searchInput = await page.waitForSelectorWithRetry('input[type="text"][placeholder*="Address"]');
      await searchInput.click();
      await this.addHumanBehavior(page);
      
      // Type slowly like a human
      for (const char of address) {
        await searchInput.type(char, { delay: 50 + Math.random() * 100 });
        await page.waitForTimeout(10 + Math.random() * 40);
      }
      
      await page.waitForTimeout(1000);
      
      // Submit search
      await searchInput.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      
      // Check for captcha
      const hasCaptcha = await this.handleCaptcha(page);
      if (hasCaptcha) {
        await page.waitForNavigation({ waitUntil: 'networkidle' });
      }
      
      // Take screenshot
      await this.screenshot(page, `search-${normalizeAddress(address)}`);
      
      // Check if property page is loaded directly or if we have search results
      const isPropertyPage = await this._isPropertyPage(page);
      
      if (isPropertyPage) {
        const url = page.url();
        // Extract and return property data
        const data = await this.extractPropertyData(page, url);
        await page.close();
        return [data];
      }
      
      // Handle search results
      const results = await this._extractSearchResults(page);
      
      if (results.length === 0) {
        this.logger.warn(`No results found for address: ${address}`);
        await page.close();
        return [];
      }
      
      // Extract data from each result
      const properties = [];
      for (let i = 0; i < Math.min(results.length, 3); i++) { // Limit to top 3 results
        try {
          const resultUrl = results[i];
          
          // Open new tab
          const propertyPage = await this.context.newPage();
          await propertyPage.goto(resultUrl, { waitUntil: 'networkidle' });
          await this.addHumanBehavior(propertyPage);
          
          // Extract property data
          const data = await this.extractPropertyData(propertyPage, resultUrl);
          properties.push(data);
          
          await propertyPage.close();
          
          // Add delay between requests
          await page.waitForTimeout(2000 + Math.random() * 3000);
        } catch (error) {
          this.logger.error(`Error extracting data from result ${i + 1}:`, error);
        }
      }
      
      await page.close();
      return properties;
    } catch (error) {
      this.logger.error(`Error searching for address: ${address}`, error);
      return [];
    }
  }
  
  /**
   * Check if current page is a property detail page
   */
  async _isPropertyPage(page) {
    try {
      // Check URL pattern
      const url = page.url();
      const isPropertyUrl = /zillow\.com\/(homedetails|zpid)/.test(url);
      
      // Check for property page elements
      const homeDetailsElement = await page.$('.ds-home-details-chip');
      const propertyAddressElement = await page.$('[data-testid="home-details-chip"] h1');
      
      return isPropertyUrl || !!homeDetailsElement || !!propertyAddressElement;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Extract search results from page
   */
  async _extractSearchResults(page) {
    try {
      // Wait for results to load
      await page.waitForSelectorWithRetry('[data-testid="search-results"]', { timeout: 10000 })
        .catch(() => this.logger.warn('Search results not found'));
      
      // Extract links to property pages
      const propertyLinks = await page.evaluate(() => {
        const links = [];
        const propertyCards = document.querySelectorAll('[data-test="property-card"]');
        
        propertyCards.forEach(card => {
          const anchor = card.querySelector('a[href*="/homedetails/"]');
          if (anchor && anchor.href) {
            links.push(anchor.href);
          }
        });
        
        return links;
      });
      
      return propertyLinks;
    } catch (error) {
      this.logger.error('Error extracting search results:', error);
      return [];
    }
  }
  
  /**
   * Extract property data from detail page
   */
  async extractPropertyData(page, url) {
    try {
      const zpid = this._extractZpid(url);
      
      // Take screenshot of the property page
      await this.screenshot(page, `property-${zpid}`);
      
      // Extract data using page evaluation
      const rawData = await page.evaluate(() => {
        // Helper function to extract clean text
        const getText = (selector, fallback = '') => {
          const element = document.querySelector(selector);
          return element ? element.innerText.trim() : fallback;
        };
        
        // Helper to extract meta data
        const getMeta = (name) => {
          const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
          return meta ? meta.content : null;
        };
        
        // Extract address
        let address = getText('[data-testid="home-details-chip"] h1') ||
                      getText('.ds-address-container') ||
                      getMeta('og:zillow_fb:address');
        
        // Extract price
        const priceText = getText('[data-testid="price"]') ||
                        getText('.ds-summary-row span[data-test="property-price"]') ||
                        '';
        const price = priceText.replace(/[^\d]/g, '');
        
        // Extract facts
        const factsText = getText('.ds-home-facts-table, [data-testid="facts-container"]');
        
        // Extract beds, baths, sqft
        let beds = null;
        let baths = null;
        let sqft = null;
        
        // Method 1: Summary section
        const summaryList = document.querySelectorAll('[data-testid="home-summary-list"] li, .ds-summary-row span');
        summaryList.forEach(item => {
          const text = item.innerText.toLowerCase();
          if (text.includes('bed')) beds = text.replace(/[^\d.]/g, '');
          if (text.includes('bath')) baths = text.replace(/[^\d.]/g, '');
          if (text.includes('sq ft') || text.includes('sqft')) {
            sqft = text.replace(/[^\d]/g, '');
          }
        });
        
        // Method 2: Facts section
        const factElements = document.querySelectorAll('.ds-home-fact-list > div, [data-testid="facts-list"] > li');
        factElements.forEach(fact => {
          const text = fact.innerText.toLowerCase();
          if (!beds && text.includes('bedroom')) {
            beds = text.replace(/[^\d.]/g, '');
          }
          if (!baths && text.includes('bathroom')) {
            baths = text.replace(/[^\d.]/g, '');
          }
          if (!sqft && (text.includes('square feet') || text.includes('sq ft'))) {
            sqft = text.replace(/[^\d]/g, '');
          }
        });
        
        // Extract year built
        let yearBuilt = null;
        factElements.forEach(fact => {
          const text = fact.innerText.toLowerCase();
          if (text.includes('year built') || text.includes('built in')) {
            const match = text.match(/\b(19|20)\d{2}\b/);
            if (match) yearBuilt = match[0];
          }
        });
        
        // Extract lot size
        let lotSize = null;
        factElements.forEach(fact => {
          const text = fact.innerText.toLowerCase();
          if (text.includes('lot size') || text.includes('lot:')) {
            lotSize = text.replace(/.*?:/, '').trim();
          }
        });
        
        // Extract property type
        let propertyType = null;
        factElements.forEach(fact => {
          const text = fact.innerText.toLowerCase();
          if (text.includes('type:') || text.includes('property type')) {
            propertyType = text.replace(/.*?:/, '').trim();
          }
        });
        
        // Extract description
        const description = getText('[data-testid="home-description"]') ||
                          getText('.ds-overview-section') ||
                          '';
        
        // Extract Zestimate
        const zestimateSection = document.querySelectorAll('[data-testid="zestimate-section"] span');
        let zestimate = null;
        zestimateSection.forEach(span => {
          const text = span.innerText;
          if (text.includes('$') && !zestimate) {
            zestimate = text.replace(/[^\d]/g, '');
          }
        });
        
        // Extract contact info from listing agent
        const agentSection = document.querySelector('[data-testid="contact-info"]');
        const contactInfo = {};
        if (agentSection) {
          // Try to extract agent name
          const nameElement = agentSection.querySelector('a[href*="agent/"], span');
          if (nameElement) {
            contactInfo.agentName = nameElement.innerText.trim();
          }
          
          // Try to extract agent phone
          const phoneElement = agentSection.querySelector('a[href^="tel:"]');
          if (phoneElement) {
            contactInfo.phoneNumber = phoneElement.href.replace('tel:', '');
          }
        }
        
        return {
          address,
          price: price ? parseInt(price) : null,
          bedrooms: beds ? parseFloat(beds) : null,
          bathrooms: baths ? parseFloat(baths) : null,
          squareFeet: sqft ? parseInt(sqft) : null,
          yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
          lotSize,
          propertyType,
          description,
          zestimate: zestimate ? parseInt(zestimate) : null,
          contactInfo
        };
      });
      
      // Add URL and source to data
      rawData.url = url;
      rawData.source = 'ZILLOW';
      
      // Check if it's a foreclosure
      const isForeclosure = await this._checkForForeclosure(page);
      
      // Standardize data
      const standardData = this.standardizePropertyData(
        { 
          ...rawData, 
          isForeclosure,
          estimatedValue: rawData.zestimate || rawData.price
        }, 
        this.source
      );
      
      // Normalize address format
      standardData.normalizedAddress = normalizeAddress(standardData.address);
      
      return standardData;
    } catch (error) {
      this.logger.error('Error extracting property data:', error);
      return {
        sourceKey: this.source,
        sourceUrl: url,
        capturedAt: new Date().toISOString(),
        address: '',
        normalizedAddress: ''
      };
    }
  }
  
  /**
   * Check if property is a foreclosure or pre-foreclosure
   */
  async _checkForForeclosure(page) {
    try {
      const pageContent = await page.content();
      const isForeclosure = pageContent.toLowerCase().includes('foreclosure') ||
                         pageContent.toLowerCase().includes('pre-foreclosure') ||
                         pageContent.toLowerCase().includes('reo') ||
                         pageContent.toLowerCase().includes('bank owned');
                         
      return isForeclosure;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Extract Zillow Property ID (zpid) from URL
   */
  _extractZpid(url) {
    const match = url.match(/\/homedetails\/[^/]+\/(\d+)_zpid/) || 
                url.match(/\/(\d+)_zpid/);
    return match ? match[1] : null;
  }
  
  /**
   * Search for distressed properties in a given area
   * @param {string} location - City, zip code, or neighborhood
   * @param {number} maxResults - Maximum number of results to return
   */
  async searchDistressedProperties(location, maxResults = 5) {
    try {
      // Initialize browser if needed
      if (!this.browser) {
        await this.initialize();
      }
      
      // Create a new page
      const page = await this.newPage();
      
      // Construct search URL for foreclosures
      const searchUrl = `${this.baseUrl}/foreclosures/in-${encodeURIComponent(location.replace(/\s+/g, '-'))}`;
      
      // Navigate to search URL
      await page.goto(searchUrl, {
        waitUntil: 'networkidle'
      });
      
      // Handle potential captcha
      await this.handleCaptcha(page);
      
      // Take screenshot
      await this.screenshot(page, `distressed-search-${location}`);
      
      // Extract search results
      const results = await this._extractSearchResults(page);
      
      if (results.length === 0) {
        this.logger.warn(`No distressed properties found in: ${location}`);
        await page.close();
        return [];
      }
      
      // Extract data from each result
      const properties = [];
      for (let i = 0; i < Math.min(results.length, maxResults); i++) {
        try {
          const resultUrl = results[i];
          
          // Open new tab
          const propertyPage = await this.context.newPage();
          await propertyPage.goto(resultUrl, { waitUntil: 'networkidle' });
          await this.addHumanBehavior(propertyPage);
          
          // Extract property data
          const data = await this.extractPropertyData(propertyPage, resultUrl);
          properties.push(data);
          
          await propertyPage.close();
          
          // Add delay between requests
          await page.waitForTimeout(2000 + Math.random() * 3000);
        } catch (error) {
          this.logger.error(`Error extracting data from result ${i + 1}:`, error);
        }
      }
      
      await page.close();
      return properties;
    } catch (error) {
      this.logger.error(`Error searching for distressed properties in: ${location}`, error);
      return [];
    }
  }
}

module.exports = ZillowScraper;

/**
 * playwright-scraper-base.cjs
 * Base class for Playwright-based scrapers with advanced anti-detection features
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { normalizeAddress } = require('../lib/normalize.cjs');

class PlaywrightScraperBase {
  constructor(config = {}) {
    this.config = {
      headless: true,
      useProxy: false,
      proxyUrl: null,
      userAgent: null,
      stealthMode: true,
      screenshots: false,
      screenshotDir: './screenshots',
      pageTimeout: 30000,
      navigationTimeout: 30000,
      waitForSelector: 5000,
      retries: 3,
      ...config
    };
    
    this.browser = null;
    this.context = null;
    this.currentProxy = null;
    this.logger = console; // Can be replaced with a custom logger
  }
  
  /**
   * Initialize the browser
   */
  async initialize() {
    try {
      const launchOptions = {
        headless: this.config.headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--lang=en-US,en'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        timeout: this.config.pageTimeout
      };
      
      // Add proxy if configured
      if (this.config.useProxy && this.config.proxyUrl) {
        this.currentProxy = this.config.proxyUrl;
        launchOptions.proxy = { server: this.currentProxy };
      }
      
      // Launch browser
      this.browser = await chromium.launch(launchOptions);
      
      // Create browser context with custom settings
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: this.config.userAgent || this._getRandomUserAgent(),
        locale: 'en-US',
        timezoneId: 'America/New_York',
        geolocation: { longitude: -73.935242, latitude: 40.730610 },
        permissions: ['geolocation'],
        bypassCSP: true
      });
      
      // Apply stealth mode if enabled
      if (this.config.stealthMode) {
        await this._applyStealth();
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }
  
  /**
   * Create a new page with stealth settings
   */
  async newPage() {
    if (!this.context) {
      await this.initialize();
    }
    
    const page = await this.context.newPage();
    
    // Set default timeouts
    page.setDefaultNavigationTimeout(this.config.navigationTimeout);
    page.setDefaultTimeout(this.config.waitForSelector);
    
    // Add helper functions to page
    page.waitForSelectorWithRetry = async (selector, options = {}) => {
      for (let attempt = 0; attempt < this.config.retries; attempt++) {
        try {
          return await page.waitForSelector(selector, {
            timeout: this.config.waitForSelector,
            ...options
          });
        } catch (error) {
          if (attempt === this.config.retries - 1) throw error;
          this.logger.warn(`Retrying selector ${selector}, attempt ${attempt + 1}`);
          await page.waitForTimeout(1000);
        }
      }
    };
    
    page.clickWithRetry = async (selector, options = {}) => {
      for (let attempt = 0; attempt < this.config.retries; attempt++) {
        try {
          const element = await page.waitForSelector(selector, {
            timeout: this.config.waitForSelector,
            state: 'visible'
          });
          
          await element.click(options);
          return;
        } catch (error) {
          if (attempt === this.config.retries - 1) throw error;
          this.logger.warn(`Retrying click ${selector}, attempt ${attempt + 1}`);
          await page.waitForTimeout(1000);
        }
      }
    };
    
    return page;
  }
  
  /**
   * Apply stealth mode to avoid detection
   */
  async _applyStealth() {
    // Add scripts to avoid detection
    await this.context.addInitScript(() => {
      // Override navigator properties to avoid detection
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery(parameters);
      };
      
      // Add plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: {}
            },
            name: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            description: 'Portable Document Format',
            length: 1
          },
          {
            0: {
              type: 'application/x-google-chrome-pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format'
            },
            name: 'Chrome PDF Viewer',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            description: 'Portable Document Format',
            length: 1
          },
          {
            0: {
              type: 'application/x-nacl',
              suffixes: '',
              description: 'Native Client Executable'
            },
            1: {
              type: 'application/x-pnacl',
              suffixes: '',
              description: 'Portable Native Client Executable'
            },
            name: 'Native Client',
            filename: 'internal-nacl-plugin',
            description: 'Native Client',
            length: 2
          }
        ]
      });
      
      // Add fake languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Override chrome runtime
      if (window.chrome) {
        window.chrome.runtime = { id: undefined };
      }
    });
  }
  
  /**
   * Get a random user agent string
   */
  _getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:94.0) Gecko/20100101 Firefox/94.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }
  
  /**
   * Take a screenshot
   */
  async screenshot(page, name) {
    if (!this.config.screenshots) return;
    
    try {
      if (!fs.existsSync(this.config.screenshotDir)) {
        fs.mkdirSync(this.config.screenshotDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${name ? name + '-' : ''}${timestamp}.png`;
      const filePath = path.join(this.config.screenshotDir, filename);
      
      await page.screenshot({ path: filePath, fullPage: true });
      this.logger.debug(`Screenshot saved: ${filePath}`);
    } catch (error) {
      this.logger.warn('Failed to take screenshot:', error);
    }
  }
  
  /**
   * Add random human-like behavior
   */
  async addHumanBehavior(page) {
    try {
      // Random mouse movements
      await page.mouse.move(
        100 + Math.floor(Math.random() * 500),
        100 + Math.floor(Math.random() * 500),
        { steps: 10 }
      );
      
      // Random scroll
      await page.evaluate(() => {
        window.scrollTo({
          top: Math.floor(Math.random() * 100),
          behavior: 'smooth'
        });
      });
      
      // Random wait time
      await page.waitForTimeout(500 + Math.floor(Math.random() * 1000));
    } catch (error) {
      this.logger.debug('Error in human behavior simulation:', error);
    }
  }
  
  /**
   * Extract data from property listing
   * Override in subclasses
   */
  async extractPropertyData(page, url) {
    throw new Error('Method extractPropertyData() must be implemented by subclass');
  }
  
  /**
   * Handle captcha challenges if detected
   */
  async handleCaptcha(page) {
    try {
      // Check for common captcha selectors
      const captchaSelectors = [
        'iframe[src*="captcha"]',
        'iframe[src*="recaptcha"]',
        '.g-recaptcha',
        '.captcha-container',
        '#captcha'
      ];
      
      for (const selector of captchaSelectors) {
        const captchaExists = await page.$(selector);
        if (captchaExists) {
          this.logger.warn('Captcha detected, taking screenshot and waiting...');
          await this.screenshot(page, 'captcha');
          
          // If you have a captcha solving service, integrate it here
          // For now, just wait for manual intervention or timeout
          // await page.waitForNavigation({ timeout: 60000 });
          
          // Detect if captcha is still present
          const captchaStillExists = await page.$(selector);
          if (captchaStillExists) {
            throw new Error('Captcha could not be solved');
          }
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error('Error handling captcha:', error);
      return false;
    }
  }
  
  /**
   * Clean up resources
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.context = null;
      }
    } catch (error) {
      this.logger.error('Error closing browser:', error);
    }
  }
  
  /**
   * Standardize scraped property data to common format
   */
  standardizePropertyData(data, source) {
    const standardized = {
      sourceKey: source,
      sourceUrl: data.url,
      capturedAt: new Date().toISOString(),
      address: data.address || '',
      ownerName: data.ownerName || null,
      attributes: {
        bedrooms: data.bedrooms || null,
        bathrooms: data.bathrooms || null,
        squareFeet: data.squareFeet || null,
        yearBuilt: data.yearBuilt || null,
        lotSize: data.lotSize || null,
        propertyType: data.propertyType || null
      },
      priceHint: data.price || data.estimatedValue || null,
      distressSignals: this.extractDistressSignals(data),
      contacts: this.extractContacts(data)
    };
    
    return standardized;
  }
  
  /**
   * Extract distress signals from data
   */
  extractDistressSignals(data) {
    const signals = [];
    
    // Check common distress signals based on property data
    if (data.isForeclosure || data.foreclosureStatus) signals.push('pre-foreclosure');
    if (data.isAuction || data.auctionDate) signals.push('auction-scheduled');
    if (data.taxDelinquent) signals.push('tax-lien');
    if (data.isREO || data.bankOwned) signals.push('bank-owned');
    if (data.isShortSale) signals.push('short-sale');
    if (data.isFSBO) signals.push('FSBO');
    if (data.isProbate) signals.push('probate');
    
    // Check description for distress keywords
    if (data.description) {
      const description = data.description.toLowerCase();
      const keywords = [
        { key: 'foreclos', signal: 'pre-foreclosure' },
        { key: 'auction', signal: 'auction-scheduled' },
        { key: 'bank owned', signal: 'bank-owned' },
        { key: 'reo', signal: 'bank-owned' },
        { key: 'tax sale', signal: 'tax-lien' },
        { key: 'estate sale', signal: 'probate' },
        { key: 'probate', signal: 'probate' },
        { key: 'distress', signal: 'distressed' },
        { key: 'short sale', signal: 'short-sale' },
        { key: 'must sell', signal: 'motivated-seller' },
        { key: 'fixer', signal: 'fixer-upper' },
        { key: 'as-is', signal: 'as-is' },
        { key: 'cash only', signal: 'cash-only' },
        { key: 'rehab', signal: 'fixer-upper' }
      ];
      
      for (const {key, signal} of keywords) {
        if (description.includes(key) && !signals.includes(signal)) {
          signals.push(signal);
        }
      }
    }
    
    return signals;
  }
  
  /**
   * Extract contact information
   */
  extractContacts(data) {
    const contacts = [];
    
    if (!data.contactInfo) return contacts;
    
    // Extract phone numbers
    if (data.contactInfo.phoneNumber) {
      contacts.push({
        type: 'phone',
        value: data.contactInfo.phoneNumber,
        confidence: 0.8,
        source: data.contactInfo.source || 'listing'
      });
    }
    
    // Extract email addresses
    if (data.contactInfo.email) {
      contacts.push({
        type: 'email',
        value: data.contactInfo.email,
        confidence: 0.8,
        source: data.contactInfo.source || 'listing'
      });
    }
    
    // Extract additional phone numbers from description
    if (data.description) {
      const phoneRegex = /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;
      const matches = data.description.match(phoneRegex);
      
      if (matches) {
        for (const match of matches) {
          const existing = contacts.find(c => c.type === 'phone' && c.value === match);
          if (!existing) {
            contacts.push({
              type: 'phone',
              value: match,
              confidence: 0.6,
              source: 'description'
            });
          }
        }
      }
    }
    
    return contacts;
  }
}

module.exports = PlaywrightScraperBase;

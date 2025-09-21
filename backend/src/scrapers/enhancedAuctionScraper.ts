/**
 * Enhanced Auction.com Scraper with Advanced Anti-Detection
 * 
 * This implementation adds improved anti-detection measures and debugging capabilities
 * to help diagnose and fix issues with the Auction.com scraper.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Add the stealth plugin to puppeteer
puppeteerExtra.use(StealthPlugin());

const prisma = new PrismaClient();

// User agents rotation - Updated with newer browser versions
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// Common viewport sizes for desktop browsers
const VIEWPORT_SIZES = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

// Directory for saving debug data
const DEBUG_DIR = path.join(process.cwd(), 'debug-data');

// Ensure debug directory exists
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

export interface AuctionListing {
  id: string;
  source: string; // 'auction.com', 'hubzu', 'xome', etc.
  propertyAddress: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: string;
  yearBuilt?: number;
  
  // Auction specific fields
  auctionId: string;
  auctionType: string; // 'live', 'online', 'foreclosure', etc.
  auctionStartDate: Date;
  auctionEndDate?: Date;
  startingBid?: number;
  currentBid?: number;
  estimatedValue?: number;
  depositRequired?: number;
  occupancyStatus?: string;
  
  // URLs and media
  listingUrl: string;
  images?: string[];
  
  // Additional info
  description?: string;
  features?: string[];
  sellerName?: string;
  auctionCompany?: string;
}

/**
 * Base class for auction site scrapers
 */
export abstract class BaseAuctionScraper {
  protected browser: Browser | null = null;
  protected page: Page | null = null;
  protected debugMode: boolean = false;
  protected sessionId: string = Date.now().toString();
  
  /**
   * Set debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Initialize the scraper
   */
  async initialize(): Promise<void> {
    try {
      // Select a random user agent and viewport
      const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const randomViewport = VIEWPORT_SIZES[Math.floor(Math.random() * VIEWPORT_SIZES.length)];
      
      // Configure puppeteer with enhanced stealth options
      const isHeadless = process.env.PUPPETEER_HEADLESS === 'true';
      this.browser = await puppeteerExtra.launch({
        headless: isHeadless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials',
          '--disable-features=site-per-process',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certifcate-errors',
          '--ignore-certifcate-errors-spki-list',
          `--user-agent=${randomUserAgent}`,
        ],
        defaultViewport: randomViewport,
        ignoreHTTPSErrors: true,
      });

      this.page = await this.browser.newPage();
      
      // Add JavaScript overrides to avoid detection
      await this.applyAntiDetection(randomUserAgent);
      
      // Set default navigation timeout
      this.page.setDefaultNavigationTimeout(60000);
      
      // Log initialization
      logger.info(`${this.constructor.name} initialized successfully with ${isHeadless ? 'headless' : 'visible'} browser`);
      logger.info(`Using user agent: ${randomUserAgent}`);
      logger.info(`Using viewport: ${randomViewport.width}x${randomViewport.height}`);
    } catch (error) {
      logger.error(`Failed to initialize ${this.constructor.name}:`, error);
      throw error;
    }
  }

  /**
   * Apply anti-detection measures
   */
  private async applyAntiDetection(userAgent: string): Promise<void> {
    if (!this.page) return;
    
    // Set user agent
    await this.page.setUserAgent(userAgent);

    // Set extra HTTP headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Referer': 'https://www.google.com/',
      'Cache-Control': 'max-age=0',
      'Upgrade-Insecure-Requests': '1'
    });

    // Add advanced evasion techniques via JavaScript overrides
    await this.page.evaluateOnNewDocument(() => {
      // Override navigator properties
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Add plugins array
      // @ts-ignore
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [];
          for (let i = 0; i < 3; i++) {
            plugins.push({
              name: [`PDF Viewer`, `Chrome PDF Viewer`, `Chromium PDF Viewer`][i],
              description: [`Portable Document Format`, `Portable Document Format`, `Portable Document Format`][i],
              filename: [`internal-pdf-viewer`, `mhjfbmdgcfjbbpaeojofohoefgiehjai`, `internal-pdf-viewer`][i],
              length: 1,
              item: () => null,
              namedItem: () => null,
              refresh: () => undefined,
              0: {
                description: `Portable Document Format`,
                enabledPlugin: null,
                suffixes: `pdf`,
                type: `application/pdf`,
              },
            });
          }
          return Object.setPrototypeOf(plugins, PluginArray.prototype);
        }
      });
      
      // Add Chrome runtime
      // @ts-ignore
      window.chrome = {
        runtime: {},
        loadTimes: () => {},
        csi: () => {},
        app: {},
      };
      
      // Prevent iframe detection
      // @ts-ignore
      Object.defineProperty(window, 'frameElement', { get: () => null });
      
      // Add WebGL vendor and renderer
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      // @ts-ignore
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // UNMASKED_VENDOR_WEBGL
        if (parameter === 37445) {
          return 'Google Inc. (NVIDIA)';
        }
        // UNMASKED_RENDERER_WEBGL
        if (parameter === 37446) {
          return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0, D3D11-27.21.14.5671)';
        }
        return getParameter.call(this, parameter);
      };
      
      // Overwrite toString to avoid detection
      const nativeToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        if (this === Function.prototype.toString) {
          return nativeToString.call(nativeToString);
        }
        if (this === WebGLRenderingContext.prototype.getParameter) {
          return 'function getParameter() { [native code] }';
        }
        return nativeToString.call(this);
      };
    });
    
    // Set cookies for a more "human" browsing experience
    await this.page.setCookie({
      name: 'visited_before',
      value: 'true',
      domain: 'www.auction.com',
      expires: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    });
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info(`${this.constructor.name} browser closed`);
    }
  }

  /**
   * Random delay with human-like variation
   */
  protected async randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    // More human-like random delay with Gaussian distribution
    // This creates more natural timing patterns than flat random
    const mean = (min + max) / 2;
    const stdDev = (max - min) / 6;
    
    // Box-Muller transform for Gaussian distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    let delay = Math.round(z0 * stdDev + mean);
    
    // Ensure delay stays within boundaries
    delay = Math.max(min, Math.min(max, delay));
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Save debug data (screenshot and HTML)
   */
  protected async saveDebugData(name: string): Promise<void> {
    if (!this.page || !this.debugMode) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const prefix = `${timestamp}-${name}`;
      
      // Save screenshot
      await this.page.screenshot({ 
        path: path.join(DEBUG_DIR, `${prefix}.png`),
        fullPage: true 
      });
      
      // Save HTML content
      const html = await this.page.content();
      fs.writeFileSync(
        path.join(DEBUG_DIR, `${prefix}.html`),
        html
      );
      
      logger.info(`Saved debug data for "${name}" to ${DEBUG_DIR}`);
    } catch (error) {
      logger.error(`Failed to save debug data:`, error);
    }
  }

  /**
   * Human-like mouse movements to appear more natural
   */
  protected async performRandomMouseMovements(): Promise<void> {
    if (!this.page) return;
    
    try {
      // Get page dimensions
      const dimensions = await this.page.evaluate(() => {
        return {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        };
      });
      
      // Generate 3-5 random points for mouse movement
      const numPoints = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < numPoints; i++) {
        const x = Math.floor(Math.random() * dimensions.width);
        const y = Math.floor(Math.random() * dimensions.height);
        
        await this.page.mouse.move(x, y);
        await this.randomDelay(300, 800);
      }
    } catch (error) {
      logger.debug('Error during mouse movements:', error);
    }
  }

  /**
   * Human-like scroll behavior
   */
  protected async performRandomScrolling(): Promise<void> {
    if (!this.page) return;
    
    try {
      // Get page height
      const pageHeight = await this.page.evaluate(() => document.body.scrollHeight);
      
      // Number of scroll actions (2-5)
      const scrollActions = Math.floor(Math.random() * 4) + 2;
      
      for (let i = 0; i < scrollActions; i++) {
        // Random scroll position
        const position = Math.floor(Math.random() * pageHeight * 0.8);
        
        // Scroll with easing
        await this.page.evaluate((pos) => {
          window.scrollTo({
            top: pos,
            behavior: 'smooth'
          });
        }, position);
        
        await this.randomDelay(500, 1200);
      }
    } catch (error) {
      logger.debug('Error during scrolling:', error);
    }
  }

  /**
   * Save auction listings to the database
   */
  async saveListingsToDatabase(listings: AuctionListing[]): Promise<void> {
    try {
      const savedCount = await prisma.$transaction(async (tx) => {
        let count = 0;
        
        for (const listing of listings) {
          try {
            // Check if property already exists by auctionId
            const existing = await tx.propertyRecord.findFirst({
              where: {
                source: listing.source,
                sourceId: listing.auctionId,
              },
            });

            if (!existing) {
              // Create a property hash for deduplication
              const propertyHash = Buffer.from(
                `${listing.propertyAddress}_${listing.city}_${listing.state}_${listing.zipCode}`.toLowerCase().replace(/\s+/g, '')
              ).toString('base64');
              
              await tx.propertyRecord.create({
                data: {
                  source: listing.source,
                  sourceId: listing.auctionId,
                  address: listing.propertyAddress,
                  city: listing.city,
                  state: listing.state,
                  zipCode: listing.zipCode,
                  rawData: JSON.stringify(listing),
                  propertyHash,
                },
              });
              count++;
            }
          } catch (error) {
            logger.error(`Error saving auction listing ${listing.auctionId}:`, error);
          }
        }
        
        return count;
      });

      logger.info(`Saved ${savedCount} new auction property records to database`);
    } catch (error) {
      logger.error('Error saving auction listings to database:', error);
      throw error;
    }
  }

  /**
   * Abstract method to search for auction listings by location
   */
  abstract searchListingsByLocation(locations: string[], maxPages?: number): Promise<AuctionListing[]>;
  
  /**
   * Abstract method to get details for a specific listing
   */
  abstract getListingDetails(listingUrl: string): Promise<AuctionListing>;
  
  /**
   * Run a full scraping job
   */
  async runFullScrape(locations: string[], maxPages: number = 3): Promise<void> {
    try {
      logger.info(`Starting auction scrape for ${this.constructor.name} in locations: ${locations.join(', ')}`);
      
      await this.initialize();
      
      const listings = await this.searchListingsByLocation(locations, maxPages);
      
      if (listings.length > 0) {
        await this.saveListingsToDatabase(listings);
      }
      
      await this.close();
      
      logger.info(`Completed auction scrape for ${this.constructor.name}. Found ${listings.length} listings`);
    } catch (error) {
      logger.error(`Error in full auction scrape for ${this.constructor.name}:`, error);
      await this.close();
      throw error;
    }
  }
}

/**
 * Enhanced AuctionDotCom scraper implementation
 */
export class EnhancedAuctionDotComScraper extends BaseAuctionScraper {
  /**
   * Check if CAPTCHA or anti-bot measures are present
   */
  private async detectAntiBot(): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      return await this.page.evaluate(() => {
        const html = document.documentElement.outerHTML.toLowerCase();
        
        // Check for common anti-bot indicators
        const indicators = [
          'captcha',
          'robot',
          'human verification',
          'security check',
          'check box',
          'recaptcha',
          'hcaptcha',
          'cloudflare',
          'blocked',
          'suspicious activity',
          'unusual traffic',
          'access denied',
          'verify you are a human',
        ];
        
        return indicators.some(indicator => html.includes(indicator));
      });
    } catch (error) {
      logger.error('Error detecting anti-bot measures:', error);
      return false;
    }
  }
  
  /**
   * Handle various popups and overlays that might appear on the site
   */
  private async handlePopupsAndOverlays(): Promise<void> {
    if (!this.page) {
      logger.error('Browser page is not initialized');
      return;
    }
    
    try {
      // Try all common popup and overlay selectors
      const popupSelectors = [
        'button[data-testid="cookie-banner-accept"]',
        '.cookie-banner button',
        '.modal-close',
        '.close-button',
        'button.close',
        'button[aria-label="Close"]',
        '.popup-close',
        '.dialog-close',
        '.newsletter-popup .close',
        'button[data-testid="close-popup"]',
        // Common GDPR/cookie consent selectors
        '#onetrust-accept-btn-handler',
        '.accept-cookies',
        'button:contains("Accept")', 
        'button:contains("Accept All")',
        'button:contains("I agree")',
        // Newsletter popups
        'button:contains("No Thanks")',
        'button:contains("Later")',
        'button:contains("Close")',
        // Welcome modals
        '.welcome-modal .close',
        '.welcome button',
        // Privacy notices
        '.privacy-notice button',
        '.privacy-banner button'
      ];
      
      for (const selector of popupSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            // Add a small delay before clicking to seem more human-like
            await this.randomDelay(500, 1000);
            await element.click();
            logger.info(`Closed popup/overlay with selector: ${selector}`);
            await this.randomDelay(500, 1500);
          }
        } catch (e) {
          // Ignore errors for individual selectors
        }
      }
      
      // Check for CAPTCHA
      const hasCaptcha = await this.detectAntiBot();
      if (hasCaptcha) {
        logger.warn('CAPTCHA or anti-bot measure detected!');
        await this.saveDebugData('captcha-detected');
      }
      
    } catch (error) {
      logger.error('Error handling popups and overlays:', error);
    }
  }
  
  /**
   * Search for auction listings by location with enhanced anti-detection
   */
  async searchListingsByLocation(locations: string[], maxPages: number = 3): Promise<AuctionListing[]> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    const allListings: AuctionListing[] = [];
    
    for (const location of locations) {
      try {
        logger.info(`Searching Auction.com for location: ${location}`);
        
        // Simulate starting from Google
        await this.page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 60000 });
        await this.randomDelay(1000, 3000);
        
        // Search for auction.com to seem like a regular user
        await this.page.type('input[name="q"]', 'auction.com foreclosure homes', { delay: 100 });
        await this.page.keyboard.press('Enter');
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
        
        // Find and click a link to auction.com
        const auctionLinks = await this.page.$$('a[href*="auction.com"]');
        if (auctionLinks.length > 0) {
          await auctionLinks[0].click();
          await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
        } else {
          // Direct navigation if link not found
          await this.page.goto('https://www.auction.com', { waitUntil: 'networkidle2', timeout: 60000 });
        }
        
        // Handle initial popups
        await this.handlePopupsAndOverlays();
        
        // Perform some random mouse movements and scrolling
        await this.performRandomMouseMovements();
        await this.performRandomScrolling();
        
        // Look for search box and type the location (with human-like typing)
        await this.randomDelay(1000, 2000);
        try {
          const searchBoxSelectors = [
            'input[placeholder*="Search"]',
            'input[name="search"]',
            'input[placeholder*="City"]',
            'input[type="search"]'
          ];
          
          let searchBoxFound = false;
          for (const selector of searchBoxSelectors) {
            const searchBox = await this.page.$(selector);
            if (searchBox) {
              // Clear any existing text
              await this.page.evaluate((sel) => {
                const element = document.querySelector(sel) as HTMLInputElement;
                if (element) element.value = '';
              }, selector);
              
              // Type with variable speed
              await this.page.type(selector, location, { delay: Math.floor(Math.random() * 100) + 50 });
              searchBoxFound = true;
              break;
            }
          }
          
          if (!searchBoxFound) {
            // If search box not found, navigate directly to the search URL
            const searchUrl = `https://www.auction.com/residential/search?search=${encodeURIComponent(location)}`;
            await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          } else {
            // Press Enter to search
            await this.randomDelay(500, 1500);
            await this.page.keyboard.press('Enter');
            await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
          }
        } catch (e) {
          logger.warn('Error with search box interaction, using direct URL');
          const searchUrl = `https://www.auction.com/residential/search?search=${encodeURIComponent(location)}`;
          await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        }
        
        // Handle popups again after search
        await this.handlePopupsAndOverlays();
        
        // Save debug data for search results
        if (this.debugMode) {
          await this.saveDebugData(`search-results-${location.replace(/\s+/g, '-')}`);
        }
        
        // Check for anti-bot measures on the search page
        const hasAntiBot = await this.detectAntiBot();
        if (hasAntiBot) {
          logger.error(`Anti-bot measures detected for location ${location}. Skipping.`);
          continue;
        }
        
        // Process search results pages
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          logger.info(`Processing Auction.com page ${pageNum} for location: ${location}`);
          
          // Perform natural scrolling behavior
          await this.performRandomScrolling();
          
          // Try different selectors to find property listings
          try {
            // Use Promise.race to wait for any of the possible selectors
            await Promise.race([
              this.page.waitForSelector('.property-details', { timeout: 20000 }),
              this.page.waitForSelector('.property-card', { timeout: 20000 }),
              this.page.waitForSelector('[data-testid="property-card"]', { timeout: 20000 }),
              this.page.waitForSelector('.auction-item', { timeout: 20000 }),
              this.page.waitForSelector('.search-result-item', { timeout: 20000 }),
              this.page.waitForSelector('.property-listing', { timeout: 20000 }),
            ]);
          } catch (error) {
            // If no selectors match, save debug data
            if (this.debugMode) {
              await this.saveDebugData(`no-listings-found-${location}-page-${pageNum}`);
            }
            
            logger.warn(`No property listings found on page ${pageNum} for ${location}`);
            break;
          }
          
          // Extract listing data
          const pageListings = await this.page.evaluate(() => {
            const listings: any[] = [];
            
            // Try multiple selector patterns to find property cards
            const selectors = [
              '.property-card', 
              '[data-testid="property-card"]', 
              '.auction-item',
              '.search-result-item',
              '.property-listing'
            ];
            
            let propertyCards: NodeListOf<Element> | null = null;
            
            // Find the first selector that returns results
            for (const selector of selectors) {
              const cards = document.querySelectorAll(selector);
              if (cards && cards.length > 0) {
                propertyCards = cards;
                break;
              }
            }
            
            // If we found property cards, try to extract data
            if (propertyCards) {
              propertyCards.forEach((card) => {
                try {
                  const listing: any = {
                    source: 'auction.com',
                    propertyType: 'unknown',
                    auctionStartDate: new Date(), // Default to current date if not found
                  };
                  
                  // Extract listing URL and auction ID
                  const linkSelectors = [
                    '.property-details a', 
                    'a.property-link', 
                    'a[href*="auction.com/details"]',
                    'a[data-testid="property-link"]',
                    'a[href*="/details/"]',
                    'a.card-link'
                  ];
                  
                  for (const selector of linkSelectors) {
                    const linkEl = card.querySelector(selector);
                    if (linkEl) {
                      listing.listingUrl = (linkEl as HTMLAnchorElement).href;
                      const match = listing.listingUrl.match(/\/(\d+)-([^/]+)$/) || 
                                    listing.listingUrl.match(/\/details\/(\d+)/) ||
                                    listing.listingUrl.match(/id=(\d+)/);
                      if (match) {
                        listing.auctionId = match[1];
                        break;
                      }
                    }
                  }
                  
                  // Address selectors
                  const addressSelectors = [
                    '.street-address', 
                    '.property-address', 
                    '[data-testid="property-address"]',
                    '.address-line',
                    '.listing-address',
                    '[data-automation="address"]'
                  ];
                  
                  for (const selector of addressSelectors) {
                    const addressEl = card.querySelector(selector);
                    if (addressEl) {
                      listing.propertyAddress = addressEl.textContent?.trim() || '';
                      break;
                    }
                  }
                  
                  // City/State/Zip selectors
                  const cityStateSelectors = [
                    '.city-state-zip', 
                    '.property-location', 
                    '[data-testid="property-location"]',
                    '.location',
                    '.listing-location',
                    '[data-automation="location"]'
                  ];
                  
                  for (const selector of cityStateSelectors) {
                    const cityStateEl = card.querySelector(selector);
                    if (cityStateEl) {
                      const cityStateText = cityStateEl.textContent?.trim() || '';
                      const parts = cityStateText.split(',');
                      
                      if (parts.length > 0) {
                        listing.city = parts[0].trim();
                      }
                      
                      if (parts.length > 1) {
                        const stateZip = parts[1].trim().split(' ');
                        listing.state = stateZip[0];
                        listing.zipCode = stateZip[1] || '';
                      }
                      break;
                    }
                  }
                  
                  // Try to extract bedroom count
                  const bedSelectors = [
                    '.beds-baths-sqft .beds', 
                    '.beds', 
                    '[data-testid="beds"]',
                    '.property-beds',
                    '[data-automation="beds"]'
                  ];
                  
                  for (const selector of bedSelectors) {
                    const bedsEl = card.querySelector(selector);
                    if (bedsEl) {
                      const beds = bedsEl.textContent?.trim().match(/\d+/);
                      if (beds) {
                        listing.bedrooms = parseInt(beds[0]);
                        break;
                      }
                    }
                  }
                  
                  // Bathroom count
                  const bathSelectors = [
                    '.beds-baths-sqft .baths', 
                    '.baths', 
                    '[data-testid="baths"]',
                    '.property-baths',
                    '[data-automation="baths"]'
                  ];
                  
                  for (const selector of bathSelectors) {
                    const bathsEl = card.querySelector(selector);
                    if (bathsEl) {
                      const baths = bathsEl.textContent?.trim().match(/\d+(\.\d+)?/);
                      if (baths) {
                        listing.bathrooms = parseFloat(baths[0]);
                        break;
                      }
                    }
                  }
                  
                  // Square footage
                  const sqftSelectors = [
                    '.beds-baths-sqft .sqft', 
                    '.sqft', 
                    '[data-testid="sqft"]',
                    '.property-sqft',
                    '[data-automation="sqft"]'
                  ];
                  
                  for (const selector of sqftSelectors) {
                    const sqftEl = card.querySelector(selector);
                    if (sqftEl) {
                      const sqft = sqftEl.textContent?.trim().match(/[\d,]+/);
                      if (sqft) {
                        listing.squareFootage = parseInt(sqft[0].replace(/,/g, ''));
                        break;
                      }
                    }
                  }
                  
                  // Price/bid information
                  const priceSelectors = [
                    '.price-info .price', 
                    '.price', 
                    '[data-testid="price"]',
                    '.property-price',
                    '.starting-bid',
                    '.current-bid',
                    '[data-automation="price"]'
                  ];
                  
                  for (const selector of priceSelectors) {
                    const priceEl = card.querySelector(selector);
                    if (priceEl) {
                      const price = priceEl.textContent?.trim().match(/[\d,]+/);
                      if (price) {
                        listing.startingBid = parseInt(price[0].replace(/,/g, ''));
                        break;
                      }
                    }
                  }
                  
                  // Auction date
                  const dateSelectors = [
                    '.auction-date', 
                    '.date', 
                    '[data-testid="auction-date"]',
                    '.property-auction-date',
                    '[data-automation="auction-date"]'
                  ];
                  
                  for (const selector of dateSelectors) {
                    const auctionDateEl = card.querySelector(selector);
                    if (auctionDateEl) {
                      const dateText = auctionDateEl.textContent?.trim() || '';
                      if (dateText) {
                        try {
                          listing.auctionStartDate = new Date(dateText);
                        } catch (e) {
                          // If date parsing fails, keep default
                        }
                        break;
                      }
                    }
                  }
                  
                  // Auction type
                  const typeSelectors = [
                    '.auction-type', 
                    '.type', 
                    '[data-testid="auction-type"]',
                    '.property-auction-type',
                    '[data-automation="auction-type"]'
                  ];
                  
                  for (const selector of typeSelectors) {
                    const auctionTypeEl = card.querySelector(selector);
                    if (auctionTypeEl) {
                      listing.auctionType = auctionTypeEl.textContent?.trim().toLowerCase() || 'unknown';
                      break;
                    }
                  }
                  
                  // Property type
                  const propertyTypeSelectors = [
                    '.property-type', 
                    '[data-testid="property-type"]',
                    '.listing-type',
                    '[data-automation="property-type"]'
                  ];
                  
                  for (const selector of propertyTypeSelectors) {
                    const typeEl = card.querySelector(selector);
                    if (typeEl) {
                      listing.propertyType = typeEl.textContent?.trim().toLowerCase() || 'unknown';
                      break;
                    }
                  }
                  
                  // Image - try multiple selectors
                  const imageSelectors = [
                    '.photo-carousel img', 
                    '.property-image img', 
                    'img.listing-image',
                    '[data-testid="property-image"]',
                    'img[src*="auction.com"]',
                    '[data-automation="property-image"] img'
                  ];
                  
                  listing.images = [];
                  for (const selector of imageSelectors) {
                    const imgEl = card.querySelector(selector);
                    if (imgEl && (imgEl as HTMLImageElement).src) {
                      listing.images = [(imgEl as HTMLImageElement).src];
                      break;
                    }
                  }
                  
                  // Only add valid listings with at least an address or ID
                  if ((listing.auctionId || listing.propertyAddress) && Object.keys(listing).length > 3) {
                    listings.push(listing);
                  }
                } catch (error) {
                  console.error('Error extracting auction listing:', error);
                }
              });
            }
            
            return listings;
          });
          
          // Add the listings from this page to our total
          allListings.push(...pageListings);
          logger.info(`Extracted ${pageListings.length} listings from page ${pageNum}`);
          
          if (pageListings.length === 0) {
            logger.warn(`No listings found on page ${pageNum}. Possible website structure change.`);
          }
          
          // Stop if we've reached the max pages or there are no more pages
          if (pageNum >= maxPages) {
            break;
          }
          
          // Scroll down to expose the pagination controls
          await this.performRandomScrolling();
          
          // Try to click the next page button with human-like behavior
          await this.randomDelay(1000, 2000);
          
          // Try multiple selectors for pagination
          const nextButtonSelectors = [
            '.pagination-next:not(.disabled)', 
            '[data-testid="pagination-next"]', 
            'a.next-page',
            '.pagination .next',
            'button[aria-label="Next page"]',
            'a[aria-label="Next"]'
          ];
          
          let nextButtonFound = false;
          for (const selector of nextButtonSelectors) {
            try {
              const nextButton = await this.page.$(selector);
              if (nextButton) {
                // Move mouse to button before clicking (more human-like)
                const boundingBox = await nextButton.boundingBox();
                if (boundingBox) {
                  await this.page.mouse.move(
                    boundingBox.x + boundingBox.width / 2,
                    boundingBox.y + boundingBox.height / 2
                  );
                  await this.randomDelay(300, 800);
                }
                
                // Click the button
                await nextButton.click();
                await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
                nextButtonFound = true;
                break;
              }
            } catch (e) {
              logger.debug(`Error with selector ${selector}:`, e);
            }
          }
          
          if (!nextButtonFound) {
            logger.info('No next button found, reached last page or pagination structure changed');
            break;
          }
          
          // Handle any popups that might appear after navigation
          await this.handlePopupsAndOverlays();
          
          // Random delay between page navigation to appear more human-like
          await this.randomDelay(2000, 4000);
        }
      } catch (error) {
        logger.error(`Error scraping Auction.com for location ${location}:`, error);
      }
    }
    
    return allListings;
  }
  
  /**
   * Get detailed information about a specific listing
   */
  async getListingDetails(listingUrl: string): Promise<AuctionListing> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    try {
      // Random delay before navigating to seem more natural
      await this.randomDelay(1000, 3000);
      
      // Navigate to the listing page
      logger.info(`Navigating to listing: ${listingUrl}`);
      await this.page.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Random delay to let the page fully load
      await this.randomDelay(2000, 4000);
      
      // Handle any popups or overlays
      await this.handlePopupsAndOverlays();
      
      // Perform natural scrolling and mouse movements
      await this.performRandomMouseMovements();
      await this.performRandomScrolling();
      
      // Save debug data if in debug mode
      if (this.debugMode) {
        await this.saveDebugData(`listing-detail-${listingUrl.split('/').pop()}`);
      }
      
      // Wait for content to be visible using multiple possible selectors
      try {
        await Promise.race([
          this.page.waitForSelector('.property-address', { timeout: 20000 }),
          this.page.waitForSelector('.property-details', { timeout: 20000 }),
          this.page.waitForSelector('.property-info', { timeout: 20000 }),
          this.page.waitForSelector('.property-content', { timeout: 20000 }),
        ]);
      } catch (error) {
        logger.warn(`Timed out waiting for detail selectors on ${listingUrl}. Continuing anyway.`);
      }
      
      // Extract the listing details
      const listing = await this.page.evaluate(() => {
        const details: any = {
          source: 'auction.com',
          listingUrl: window.location.href,
          auctionStartDate: new Date(), // Default value
          propertyType: 'unknown',
          features: [],
          images: [],
        };
        
        // Try multiple patterns to extract auction ID from URL
        const urlPatterns = [
          /\/(\d+)-([^/]+)$/,
          /\/details\/(\d+)/,
          /id=(\d+)/
        ];
        
        for (const pattern of urlPatterns) {
          const match = window.location.href.match(pattern);
          if (match) {
            details.auctionId = match[1];
            break;
          }
        }
        
        // Property address - try multiple selectors
        const addressSelectors = [
          '.property-address', 
          '[data-testid="property-address"]',
          '.listing-address',
          'h1.address',
          '.address-line',
          '[data-automation="property-address"]'
        ];
        
        for (const selector of addressSelectors) {
          const addressEl = document.querySelector(selector);
          if (addressEl) {
            details.propertyAddress = addressEl.textContent?.trim() || '';
            break;
          }
        }
        
        // City, state, zip - try multiple selectors
        const cityStateSelectors = [
          '.property-city-state', 
          '[data-testid="property-location"]',
          '.listing-location',
          '.property-location',
          '.city-state-zip',
          '[data-automation="property-location"]'
        ];
        
        for (const selector of cityStateSelectors) {
          const cityStateEl = document.querySelector(selector);
          if (cityStateEl) {
            const cityStateText = cityStateEl.textContent?.trim() || '';
            const parts = cityStateText.split(',');
            
            if (parts.length > 0) {
              details.city = parts[0].trim();
            }
            
            if (parts.length > 1) {
              const stateZip = parts[1].trim().split(' ');
              details.state = stateZip[0];
              details.zipCode = stateZip[1] || '';
            }
            break;
          }
        }
        
        // Flexible property detail extraction - try multiple patterns
        const detailContainerSelectors = [
          '.property-detail-item',
          '.property-details li',
          '.property-info-item',
          '.detail-row',
          '.property-feature',
          '.listing-detail-item',
          '[data-automation="property-detail-item"]'
        ];
        
        // Find which selector pattern works for this page
        let detailItems: NodeListOf<Element> | null = null;
        for (const selector of detailContainerSelectors) {
          const items = document.querySelectorAll(selector);
          if (items && items.length > 0) {
            detailItems = items;
            break;
          }
        }
        
        // Process property details if found
        if (detailItems) {
          detailItems.forEach((item) => {
            // Try multiple selector patterns for label/value pairs
            let label = '', value = '';
            
            // Try first pattern: separate elements for label and value
            const labelSelectors = ['.detail-label', '.label', '[data-testid="detail-label"]', '[data-automation="detail-label"]'];
            const valueSelectors = ['.detail-value', '.value', '[data-testid="detail-value"]', '[data-automation="detail-value"]'];
            
            // Try to find the label
            for (const selector of labelSelectors) {
              const labelEl = item.querySelector(selector);
              if (labelEl) {
                label = labelEl.textContent?.trim().toLowerCase() || '';
                break;
              }
            }
            
            // Try to find the value
            for (const selector of valueSelectors) {
              const valueEl = item.querySelector(selector);
              if (valueEl) {
                value = valueEl.textContent?.trim() || '';
                break;
              }
            }
            
            // If we couldn't find separate label/value elements, try other patterns
            if (!label || !value) {
              // Try pattern where label and value are in the same element with a separator
              const fullText = item.textContent?.trim() || '';
              if (fullText.includes(':')) {
                const parts = fullText.split(':');
                label = parts[0].trim().toLowerCase();
                value = parts[1].trim();
              } else if (fullText.includes('-')) {
                const parts = fullText.split('-');
                label = parts[0].trim().toLowerCase();
                value = parts[1].trim();
              }
            }
            
            // Process the extracted label/value pairs
            if (label && value) {
              // Bedrooms
              if (label.includes('bed') || label.includes('br')) {
                const beds = value.match(/\d+/);
                if (beds) details.bedrooms = parseInt(beds[0]);
              } 
              // Bathrooms
              else if (label.includes('bath') || label.includes('ba')) {
                const baths = value.match(/\d+(\.\d+)?/);
                if (baths) details.bathrooms = parseFloat(baths[0]);
              } 
              // Square footage
              else if (label.includes('sq') && label.includes('ft') || label.includes('sqft') || label.includes('square')) {
                const sqft = value.match(/[\d,]+/);
                if (sqft) details.squareFootage = parseInt(sqft[0].replace(/,/g, ''));
              } 
              // Lot size
              else if (label.includes('lot') || label.includes('acres') || label.includes('land')) {
                details.lotSize = value;
              } 
              // Year built
              else if (label.includes('year') && label.includes('built')) {
                const year = value.match(/\d{4}/);
                if (year) details.yearBuilt = parseInt(year[0]);
              } 
              // Property type
              else if (label.includes('property type') || label.includes('home type')) {
                details.propertyType = value.toLowerCase();
              } 
              // Occupancy
              else if (label.includes('occupancy') || label.includes('occupied')) {
                details.occupancyStatus = value;
              }
              // Starting bid
              else if (label.includes('starting bid') || label.includes('opening bid') || label.includes('min bid')) {
                const bid = value.match(/[\d,]+/);
                if (bid) details.startingBid = parseInt(bid[0].replace(/,/g, ''));
              }
              // Current bid
              else if (label.includes('current bid') || label.includes('high bid')) {
                const bid = value.match(/[\d,]+/);
                if (bid) details.currentBid = parseInt(bid[0].replace(/,/g, ''));
              }
              // Estimated value
              else if (label.includes('estimated') && (label.includes('value') || label.includes('worth'))) {
                const val = value.match(/[\d,]+/);
                if (val) details.estimatedValue = parseInt(val[0].replace(/,/g, ''));
              }
              // Auction date
              else if (label.includes('auction date') || label.includes('sale date')) {
                try {
                  details.auctionStartDate = new Date(value);
                } catch (e) {
                  // Keep default date if parsing fails
                }
              }
              // Auction type
              else if (label.includes('auction type') || label.includes('sale type')) {
                details.auctionType = value.toLowerCase();
              }
              // Deposit
              else if (label.includes('deposit') || label.includes('earnest')) {
                const deposit = value.match(/[\d,]+/);
                if (deposit) details.depositRequired = parseInt(deposit[0].replace(/,/g, ''));
              }
            }
          });
        }
        
        // Description - try multiple selectors
        const descriptionSelectors = [
          '.property-description', 
          '[data-testid="property-description"]',
          '.listing-description',
          '.description-text',
          '#property-description',
          '[data-automation="property-description"]'
        ];
        
        for (const selector of descriptionSelectors) {
          const descriptionEl = document.querySelector(selector);
          if (descriptionEl) {
            details.description = descriptionEl.textContent?.trim() || '';
            break;
          }
        }
        
        // Features - try multiple selectors
        const featureListSelectors = [
          '.features-list li', 
          '.property-features li',
          '.amenities li',
          '[data-testid="features-list"] li',
          '[data-automation="features-list"] li'
        ];
        
        for (const selector of featureListSelectors) {
          const featureList = document.querySelectorAll(selector);
          if (featureList && featureList.length > 0) {
            details.features = Array.from(featureList).map(el => el.textContent?.trim() || '');
            break;
          }
        }
        
        // Images - try multiple selectors
        const imageSelectors = [
          '.photo-carousel img', 
          '.gallery img',
          '.property-images img',
          '[data-testid="property-image"]',
          'img.listing-image',
          '[data-automation="property-image"] img'
        ];
        
        for (const selector of imageSelectors) {
          const imageElements = document.querySelectorAll(selector);
          if (imageElements && imageElements.length > 0) {
            details.images = Array.from(imageElements).map(img => {
              // Safely cast Element to HTMLImageElement or use getAttribute
              return (img instanceof HTMLImageElement) ? img.src : 
                     img.getAttribute('src') || img.getAttribute('data-src') || '';
            }).filter(src => src); // Filter out empty strings
            break;
          }
        }
        
        return details;
      });
      
      return listing as AuctionListing;
    } catch (error) {
      logger.error(`Error getting auction listing details from ${listingUrl}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const enhancedAuctionDotComScraper = new EnhancedAuctionDotComScraper();

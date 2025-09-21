/**
 * Enhanced Zillow Scraper with Advanced Anti-Detection
 * 
 * This implementation adds improved anti-detection measures and debugging capabilities
 * to help diagnose and fix issues with the Zillow scraper.
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

export interface ZillowListing {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType: string;
  timeOnMarket?: number;
  priceHistory?: any[];
  description?: string;
  listingUrl: string;
  zillowId: string;
  images?: string[];
  agentInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

export class EnhancedZillowScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private debugMode: boolean = false;
  private sessionId: string = Date.now().toString();

  /**
   * Set debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

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
      
      // Apply anti-detection measures
      await this.applyAntiDetection(randomUserAgent);
      
      // Set default navigation timeout
      this.page.setDefaultNavigationTimeout(60000);
      
      // Log initialization
      logger.info(`Zillow scraper initialized successfully with ${isHeadless ? 'headless' : 'visible'} browser`);
      logger.info(`Using user agent: ${randomUserAgent}`);
      logger.info(`Using viewport: ${randomViewport.width}x${randomViewport.height}`);
    } catch (error) {
      logger.error('Failed to initialize Zillow scraper:', error);
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
    });
    
    // Set cookies for a more "human" browsing experience
    await this.page.setCookie({
      name: 'visited_before',
      value: 'true',
      domain: 'www.zillow.com',
      expires: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    });

    // Additional cookie to bypass some Zillow restrictions
    await this.page.setCookie({
      name: 'zguid',
      value: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      domain: '.zillow.com',
      expires: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Zillow scraper browser closed');
    }
  }

  /**
   * Human-like random delay with Gaussian distribution
   */
  private async randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    // More human-like random delay with Gaussian distribution
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
  private async saveDebugData(name: string): Promise<void> {
    if (!this.page || !this.debugMode) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const prefix = `${timestamp}-zillow-${name}`;
      
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
      
      logger.info(`Saved Zillow debug data for "${name}" to ${DEBUG_DIR}`);
    } catch (error) {
      logger.error(`Failed to save debug data:`, error);
    }
  }

  /**
   * Human-like mouse movements to appear more natural
   */
  private async performRandomMouseMovements(): Promise<void> {
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
  private async performRandomScrolling(): Promise<void> {
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
   * Handle popup dialogs and banners on Zillow
   */
  private async handlePopupsAndOverlays(): Promise<void> {
    if (!this.page) return;
    
    try {
      // Common Zillow popup selectors
      const popupSelectors = [
        // Cookie consent
        '[data-testid="cookie-banner-accept"]',
        '.cookie-banner-btn',
        // Email signup popups
        '.email-capture-close',
        '[data-testid="modal-close"]',
        '.modal-dialog button.close',
        // Welcome screens
        '.welcome-message-close',
        // App download prompts
        '.app-download-close',
        // Generic close buttons
        '.dialog-close',
        'button[aria-label="Close"]',
        'button.modal-close'
      ];
      
      for (const selector of popupSelectors) {
        try {
          const buttons = await this.page.$$(selector);
          for (const button of buttons) {
            await this.randomDelay(300, 800);
            await button.click();
            logger.debug(`Clicked popup/overlay with selector: ${selector}`);
          }
        } catch (e) {
          // Ignore errors for individual selectors
        }
      }
      
      // Check for CAPTCHA
      const hasCaptcha = await this.page.evaluate(() => {
        const html = document.documentElement.outerHTML.toLowerCase();
        return html.includes('captcha') || 
               html.includes('robot') || 
               html.includes('recaptcha') ||
               html.includes('verify you are human');
      });
      
      if (hasCaptcha) {
        logger.warn('CAPTCHA detected on Zillow!');
        if (this.debugMode) {
          await this.saveDebugData('captcha-detected');
        }
      }
    } catch (error) {
      logger.error('Error handling popups:', error);
    }
  }

  /**
   * Scrape FSBO (For Sale By Owner) listings by zip code
   */
  async scrapeFSBOListings(
    zipCodes: string[] = ['07001', '07002', '07003'], // Default NJ zip codes
    maxPages: number = 5
  ): Promise<ZillowListing[]> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const allListings: ZillowListing[] = [];

    for (const zipCode of zipCodes) {
      logger.info(`Scraping Zillow FSBO listings for zip code: ${zipCode}`);
      
      try {
        // Start with Google to appear more natural
        await this.page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
        await this.performRandomMouseMovements();
        
        // Search for Zillow on Google
        await this.page.type('input[name="q"]', 'zillow for sale by owner', { delay: 100 });
        await this.page.keyboard.press('Enter');
        await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // Click on the Zillow link
        const zillowLinks = await this.page.$$('a[href*="zillow.com"]');
        if (zillowLinks.length > 0) {
          await this.randomDelay(1000, 2000);
          await zillowLinks[0].click();
          await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
        } else {
          // Direct navigation if link not found
          await this.page.goto('https://www.zillow.com', { waitUntil: 'networkidle2' });
        }
        
        // Handle any initial popups
        await this.handlePopupsAndOverlays();
        
        // Wait for search box
        await this.page.waitForSelector('input[type="text"], input[placeholder*="Enter"]', { timeout: 10000 });
        
        // Some human-like behavior
        await this.performRandomMouseMovements();
        
        // Search for the zip code
        const searchBoxes = await this.page.$$('input[type="text"], input[placeholder*="Enter"]');
        if (searchBoxes.length > 0) {
          await searchBoxes[0].click();
          await this.randomDelay(300, 800);
          await searchBoxes[0].type(zipCode, { delay: 100 });
          await this.page.keyboard.press('Enter');
        } else {
          // If we can't find the search box, navigate directly to the FSBO URL
          const searchUrl = `https://www.zillow.com/homes/for_sale/${zipCode}_rb/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22${zipCode}%22%2C%22mapBounds%22%3A%7B%7D%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A%22${zipCode}%22%2C%22regionType%22%3A7%7D%5D%2C%22isMapVisible%22%3Atrue%2C%22filterState%22%3A%7B%22fsbo%22%3A%7B%22value%22%3Atrue%7D%2C%22ah%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%7D`;
          await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
        }
        
        // Wait for the search results to load
        await this.randomDelay(2000, 4000);
        
        // Make sure we're filtering for FSBO
        try {
          // Click on "More" filters if available
          const moreFiltersButton = await this.page.$('button[data-testid="more-filters-button"], [data-testid="filter-button"] button:last-child');
          if (moreFiltersButton) {
            await moreFiltersButton.click();
            await this.randomDelay(1000, 2000);
            
            // Look for FSBO checkbox
            const fsboCheckbox = await this.page.$('input[name="fsbo"], input[id*="fsbo"], input[name*="owner"]');
            if (fsboCheckbox) {
              await fsboCheckbox.click();
              await this.randomDelay(500, 1000);
              
              // Click Apply
              const applyButton = await this.page.$('button[data-testid="apply-filters"], button:contains("Apply")');
              if (applyButton) {
                await applyButton.click();
                await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
              }
            }
          }
        } catch (e) {
          logger.warn('Error setting FSBO filter:', e);
          
          // Try direct URL with FSBO filter
          const searchUrl = `https://www.zillow.com/homes/for_sale/${zipCode}_rb/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22${zipCode}%22%2C%22mapBounds%22%3A%7B%7D%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A%22${zipCode}%22%2C%22regionType%22%3A7%7D%5D%2C%22isMapVisible%22%3Atrue%2C%22filterState%22%3A%7B%22fsbo%22%3A%7B%22value%22%3Atrue%7D%2C%22ah%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%7D`;
          await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
        }
        
        // Handle popups again after search
        await this.handlePopupsAndOverlays();
        
        // Save debug data for search results
        if (this.debugMode) {
          await this.saveDebugData(`search-results-${zipCode}`);
        }
        
        // Process search results pages
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          logger.info(`Processing Zillow page ${pageNum} for zip code ${zipCode}`);
          
          // Human-like behavior
          await this.performRandomScrolling();
          
          // Try to find property cards
          try {
            // Wait for listings to load with multiple possible selectors
            await Promise.race([
              this.page.waitForSelector('[data-test="property-card"], article[data-testid], div[id^="zpid_"]', { timeout: 15000 }),
              this.page.waitForSelector('.list-card, .property-card, .photo-card', { timeout: 15000 })
            ]);
          } catch (error) {
            logger.warn(`No property listings found on page ${pageNum} for ${zipCode}`);
            
            if (this.debugMode) {
              await this.saveDebugData(`no-listings-${zipCode}-page-${pageNum}`);
            }
            
            break;
          }
          
          // Extract listing data
          const pageListings = await this.page.evaluate(() => {
            const listings: any[] = [];
            
            // Try multiple selector patterns for property cards
            const selectors = [
              '[data-test="property-card"]', 
              'article[data-testid]', 
              'div[id^="zpid_"]',
              '.list-card',
              '.property-card',
              '.photo-card'
            ];
            
            // Find the first selector that works
            let propertyCards: NodeListOf<Element> | null = null;
            
            for (const selector of selectors) {
              const cards = document.querySelectorAll(selector);
              if (cards && cards.length > 0) {
                propertyCards = cards;
                break;
              }
            }
            
            // If property cards are found, extract the data
            if (propertyCards) {
              propertyCards.forEach((card) => {
                try {
                  const listing: any = {
                    propertyType: 'single_family',  // Default
                    source: 'zillow_fsbo',
                  };
                  
                  // Address - try multiple selectors
                  const addressSelectors = [
                    '[data-test="property-card-addr"]',
                    '[data-testid="property-card-addr"]',
                    '.list-card-addr',
                    '.property-card-address',
                    'address'
                  ];
                  
                  for (const selector of addressSelectors) {
                    const addressEl = card.querySelector(selector);
                    if (addressEl) {
                      const fullAddress = addressEl.textContent?.trim() || '';
                      const addressParts = fullAddress.split(', ');
                      
                      listing.address = addressParts[0] || '';
                      
                      if (addressParts.length > 1) {
                        listing.city = addressParts[1] || '';
                      }
                      
                      if (addressParts.length > 2) {
                        const stateZip = addressParts[2]?.split(' ');
                        if (stateZip && stateZip.length > 0) {
                          listing.state = stateZip[0] || '';
                          listing.zipCode = stateZip[1] || '';
                        }
                      }
                      
                      break;
                    }
                  }
                  
                  // Price - try multiple selectors
                  const priceSelectors = [
                    '[data-test="property-card-price"]',
                    '[data-testid="price"]',
                    '.list-card-price',
                    '.list-price',
                    '.property-card-price'
                  ];
                  
                  for (const selector of priceSelectors) {
                    const priceEl = card.querySelector(selector);
                    if (priceEl) {
                      const priceText = priceEl.textContent?.replace(/[^0-9]/g, '') || '0';
                      listing.price = parseInt(priceText) || 0;
                      break;
                    }
                  }
                  
                  // Property details - try multiple selectors
                  const detailsSelectors = [
                    '[data-test="property-card-details"]',
                    '[data-testid="property-details"]',
                    '.list-card-details',
                    '.property-card-details'
                  ];
                  
                  for (const selector of detailsSelectors) {
                    const detailsEl = card.querySelector(selector);
                    if (detailsEl) {
                      const detailsText = detailsEl.textContent || '';
                      
                      const bedMatch = detailsText.match(/(\d+)\s*bd/i) || detailsText.match(/(\d+)\s*bed/i);
                      const bathMatch = detailsText.match(/(\d+(?:\.\d+)?)\s*ba/i) || detailsText.match(/(\d+(?:\.\d+)?)\s*bath/i);
                      const sqftMatch = detailsText.match(/([\d,]+)\s*sqft/i) || detailsText.match(/([\d,]+)\s*sq\s*ft/i);
                      
                      if (bedMatch) listing.bedrooms = parseInt(bedMatch[1]);
                      if (bathMatch) listing.bathrooms = parseFloat(bathMatch[1]);
                      if (sqftMatch) listing.squareFootage = parseInt(sqftMatch[1].replace(/,/g, ''));
                      
                      break;
                    }
                  }
                  
                  // Link and ID - try multiple selectors
                  const linkSelectors = [
                    'a[href*="/homedetails/"]',
                    'a[href*="zillow.com"]',
                    'a[data-test="property-card-link"]'
                  ];
                  
                  for (const selector of linkSelectors) {
                    const linkEl = card.querySelector(selector) as HTMLAnchorElement;
                    if (linkEl && linkEl.href) {
                      listing.listingUrl = linkEl.href;
                      
                      // Extract the Zillow ID
                      const urlMatch = linkEl.href.match(/\/homedetails\/.*?\/(\d+)_zpid/) || 
                                       linkEl.href.match(/\/(\d+)_zpid/) || 
                                       linkEl.href.match(/zpid=(\d+)/);
                      
                      if (urlMatch) {
                        listing.zillowId = urlMatch[1];
                      }
                      
                      break;
                    }
                  }
                  
                  // Only add valid listings with address and price
                  if (listing.address && listing.price > 0 && listing.listingUrl) {
                    listings.push(listing);
                  }
                } catch (error) {
                  console.error('Error extracting listing data:', error);
                }
              });
            }
            
            return listings;
          });

          allListings.push(...pageListings);
          logger.info(`Extracted ${pageListings.length} listings from page ${pageNum}`);

          // Stop if no listings found or if we've reached the max pages
          if (pageListings.length === 0 || pageNum >= maxPages) {
            break;
          }

          // Scroll to make the next page button visible
          await this.performRandomScrolling();
          
          // Try to find and click the next page button
          try {
            const nextButtonSelectors = [
              '[aria-label="Next page"]',
              'a[rel="next"]',
              '.search-pagination-next',
              'button:contains("Next")',
              '.next'
            ];
            
            let nextButtonFound = false;
            
            for (const selector of nextButtonSelectors) {
              const nextButton = await this.page.$(selector);
              if (nextButton) {
                // Human-like behavior - move mouse to button before clicking
                const boundingBox = await nextButton.boundingBox();
                if (boundingBox) {
                  await this.page.mouse.move(
                    boundingBox.x + boundingBox.width / 2,
                    boundingBox.y + boundingBox.height / 2
                  );
                  await this.randomDelay(300, 800);
                }
                
                await nextButton.click();
                await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
                nextButtonFound = true;
                break;
              }
            }
            
            if (!nextButtonFound) {
              logger.info(`No next button found for ${zipCode}, reached the last page`);
              break;
            }
          } catch (error) {
            logger.warn(`Error navigating to next page for ${zipCode}:`, error);
            break;
          }
          
          // Handle popups after page navigation
          await this.handlePopupsAndOverlays();
          
          // Random delay between page navigation
          await this.randomDelay(2000, 4000);
        }
        
        // Longer delay between zip codes
        await this.randomDelay(5000, 8000);
      } catch (error) {
        logger.error(`Error scraping zip code ${zipCode}:`, error);
        
        if (this.debugMode) {
          await this.saveDebugData(`error-${zipCode}`);
        }
      }
    }

    logger.info(`Total FSBO listings scraped: ${allListings.length}`);
    return allListings;
  }

  /**
   * Get detailed information about a specific listing
   */
  async scrapeListingDetails(listingUrl: string): Promise<Partial<ZillowListing>> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      // Random delay before navigating
      await this.randomDelay(1000, 3000);
      
      // Navigate to the listing
      logger.info(`Navigating to listing: ${listingUrl}`);
      await this.page.goto(listingUrl, { waitUntil: 'networkidle2' });
      
      // Handle any popups
      await this.handlePopupsAndOverlays();
      
      // Human-like behavior
      await this.performRandomScrolling();
      
      // Save debug data if in debug mode
      if (this.debugMode) {
        await this.saveDebugData(`listing-detail-${listingUrl.split('/').pop()}`);
      }
      
      // Extract listing details
      const details = await this.page.evaluate(() => {
        const data: any = {};

        try {
          // Description - try multiple selectors
          const descriptionSelectors = [
            '[data-testid="home-description-text-description"]',
            '.ds-overview-section [data-testid="description"]',
            '.description-section',
            '.property-description'
          ];
          
          for (const selector of descriptionSelectors) {
            const descEl = document.querySelector(selector);
            if (descEl) {
              data.description = descEl.textContent?.trim();
              break;
            }
          }

          // Property details - try multiple selectors
          const detailsContainerSelectors = [
            '[data-testid="home-facts-grid"]',
            '.ds-home-facts-and-features',
            '.facts-container',
            '.property-facts'
          ];
          
          for (const containerSelector of detailsContainerSelectors) {
            const container = document.querySelector(containerSelector);
            if (container) {
              // Year built
              const yearBuiltSelectors = [
                'span:contains("Year built")',
                'span:contains("Built in")',
                '.year-built',
                '[data-testid="year-built"]'
              ];
              
              for (const yearSelector of yearBuiltSelectors) {
                try {
                  const yearElements = container.querySelectorAll(yearSelector);
                  for (const yearEl of yearElements) {
                    const parentEl = yearEl.parentElement;
                    if (parentEl) {
                      const yearText = parentEl.textContent || '';
                      const yearMatch = yearText.match(/\d{4}/);
                      if (yearMatch) {
                        data.yearBuilt = parseInt(yearMatch[0]);
                        break;
                      }
                    }
                  }
                  
                  if (data.yearBuilt) break;
                } catch (e) {}
              }
              
              // Lot size
              const lotSizeSelectors = [
                'span:contains("Lot size")',
                'span:contains("Lot")',
                '.lot-size',
                '[data-testid="lot-size"]'
              ];
              
              for (const lotSelector of lotSizeSelectors) {
                try {
                  const lotElements = container.querySelectorAll(lotSelector);
                  for (const lotEl of lotElements) {
                    const parentEl = lotEl.parentElement;
                    if (parentEl) {
                      const lotText = parentEl.textContent || '';
                      const lotMatch = lotText.match(/([\d,\.]+)/);
                      if (lotMatch) {
                        data.lotSize = parseFloat(lotMatch[1].replace(/,/g, ''));
                        break;
                      }
                    }
                  }
                  
                  if (data.lotSize) break;
                } catch (e) {}
              }
              
              break;
            }
          }

          // Agent info
          const agentSectionSelectors = [
            '[data-testid="agent-section"]',
            '.ds-agent-section',
            '.agent-info-section'
          ];
          
          for (const selector of agentSectionSelectors) {
            const agentSection = document.querySelector(selector);
            if (agentSection) {
              data.agentInfo = {};
              
              // Agent name
              const agentNameSelectors = [
                '[data-testid="agent-name"]',
                '.agent-name',
                '.agent-info-name'
              ];
              
              for (const nameSelector of agentNameSelectors) {
                const agentName = agentSection.querySelector(nameSelector);
                if (agentName) {
                  data.agentInfo.name = agentName.textContent?.trim();
                  break;
                }
              }
              
              // Agent phone
              const agentPhoneSelectors = [
                '[data-testid="agent-phone"]',
                '.agent-phone',
                '[href^="tel:"]'
              ];
              
              for (const phoneSelector of agentPhoneSelectors) {
                const agentPhone = agentSection.querySelector(phoneSelector);
                if (agentPhone) {
                  data.agentInfo.phone = agentPhone.textContent?.trim();
                  break;
                }
              }
              
              break;
            }
          }

          // Images
          const imageSelectors = [
            '[data-testid="property-image"] img',
            '.media-stream-image img',
            '.photo-slider img',
            '.gallery-image',
            '.slick-slide img'
          ];
          
          for (const selector of imageSelectors) {
            const imageEls = document.querySelectorAll(selector);
            if (imageEls && imageEls.length > 0) {
              data.images = Array.from(imageEls).map((img: any) => img.src).filter(Boolean).slice(0, 10);
              break;
            }
          }
        } catch (error) {
          console.error('Error extracting listing details:', error);
        }

        return data;
      });

      return details;
    } catch (error) {
      logger.error(`Error scraping listing details for ${listingUrl}:`, error);
      
      if (this.debugMode) {
        await this.saveDebugData(`detail-error-${listingUrl.split('/').pop()}`);
      }
      
      return {};
    }
  }

  /**
   * Save listings to the database
   */
  async saveListingsToDatabase(listings: ZillowListing[]): Promise<void> {
    try {
      const savedCount = await prisma.$transaction(async (tx) => {
        let count = 0;
        
        for (const listing of listings) {
          try {
            // Check if property already exists
            const existing = await tx.propertyRecord.findFirst({
              where: {
                source: 'zillow_fsbo',
                sourceId: listing.zillowId,
              },
            });

            if (!existing) {
              await tx.propertyRecord.create({
                data: {
                  source: 'zillow_fsbo',
                  sourceId: listing.zillowId,
                  address: listing.address,
                  city: listing.city,
                  state: listing.state,
                  zipCode: listing.zipCode,
                  rawData: JSON.stringify(listing),
                  propertyHash: this.generatePropertyHash(listing),
                },
              });
              count++;
            }
          } catch (error) {
            logger.error(`Error saving listing ${listing.zillowId}:`, error);
          }
        }
        
        return count;
      });

      logger.info(`Saved ${savedCount} new property records to database`);
    } catch (error) {
      logger.error('Error saving listings to database:', error);
      throw error;
    }
  }

  /**
   * Generate a unique hash for property deduplication
   */
  private generatePropertyHash(listing: ZillowListing): string {
    const key = `${listing.address}_${listing.city}_${listing.state}_${listing.zipCode}`;
    return Buffer.from(key.toLowerCase().replace(/\s+/g, '')).toString('base64');
  }

  /**
   * Run a full scraping job
   */
  async runFullScrape(zipCodes: string[], maxPages: number = 3): Promise<ZillowListing[]> {
    try {
      await this.initialize();
      
      const listings = await this.scrapeFSBOListings(zipCodes, maxPages);
      
      if (listings.length > 0) {
        await this.saveListingsToDatabase(listings);
      }
      
      await this.close();
      return listings;
    } catch (error) {
      logger.error('Error in full scrape:', error);
      await this.close();
      throw error;
    }
  }
}

// Export singleton instance
export const enhancedZillowScraper = new EnhancedZillowScraper();

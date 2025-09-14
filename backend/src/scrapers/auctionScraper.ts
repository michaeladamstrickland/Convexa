import puppeteer, { Browser, Page } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Add the stealth plugin to puppeteer
puppeteerExtra.use(StealthPlugin());

const prisma = new PrismaClient();

// User agents rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
];

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
  
  /**
   * Initialize the scraper
   */
  async initialize(): Promise<void> {
    try {
      // Select a random user agent
      const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      
      // Use puppeteerExtra with StealthPlugin instead of regular puppeteer
      this.browser = await puppeteerExtra.launch({
        headless: process.env.PUPPETEER_HEADLESS === 'true',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials',
          '--disable-features=site-per-process',
          `--user-agent=${randomUserAgent}`,
        ],
        defaultViewport: { width: 1920, height: 1080 }, // Use higher resolution viewport
        ignoreHTTPSErrors: true,
      });

      this.page = await this.browser.newPage();
      
      // Set user agent
      await this.page.setUserAgent(randomUserAgent);

      // Set viewport with a common desktop resolution
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Add extra headers to avoid being detected as a bot
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Referer': 'https://www.google.com/'
      });

      // Additional evasion techniques
      await this.page.evaluateOnNewDocument(() => {
        // Add language and platform
        Object.defineProperty(navigator, 'language', {
          get: function() {
            return 'en-US';
          },
        });
        
        Object.defineProperty(navigator, 'platform', {
          get: function() {
            return 'Win32';
          },
        });
        
        // Add hardware concurrency (common value)
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: function() {
            return 8;
          },
        });
      });

      logger.info(`${this.constructor.name} initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize ${this.constructor.name}:`, error);
      throw error;
    }
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
   * Random delay to avoid detection
   */
  protected async randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
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
 * AuctionDotCom scraper implementation
 */
export class AuctionDotComScraper extends BaseAuctionScraper {
  async searchListingsByLocation(locations: string[], maxPages: number = 3): Promise<AuctionListing[]> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    const allListings: AuctionListing[] = [];
    
    for (const location of locations) {
      try {
        // Navigate to Auction.com search page with the location using the correct URL format
        const searchUrl = `https://www.auction.com/residential/search?search=${encodeURIComponent(location)}`;
        
        // Use a longer timeout and wait for the page to be fully loaded
        await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await this.randomDelay(3000, 6000); // Longer delay to let the page fully render
        
        // Handle various popups and overlays that might appear
        await this.handlePopupsAndOverlays();
        
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          logger.info(`Scraping Auction.com page ${pageNum} for location: ${location}`);
          
          // Wait for page to load and check for multiple possible selectors
          // This helps handle changes in website structure
          try {
            // Use Promise.race to wait for any of the possible selectors
            await Promise.race([
              this.page.waitForSelector('.property-details', { timeout: 20000 }),
              this.page.waitForSelector('.property-card', { timeout: 20000 }),
              this.page.waitForSelector('[data-testid="property-card"]', { timeout: 20000 }),
              this.page.waitForSelector('.auction-item', { timeout: 20000 }),
              this.page.waitForSelector('.search-result-item', { timeout: 20000 }),
            ]);
          } catch (error) {
            // If no selectors match, take a screenshot for debugging and check page content
            await this.page.screenshot({ 
              path: `auction-scraper-error-${Date.now()}.png`,
              fullPage: true 
            });

            // Get page HTML for debugging
            const pageHtml = await this.page.content();
            logger.error(`Failed to find property listings on page. HTML preview: ${pageHtml.substring(0, 500)}...`);
            
            // Check if we got captcha or access denied
            if (pageHtml.includes('captcha') || pageHtml.includes('robot') || 
                pageHtml.includes('access denied') || pageHtml.includes('blocked')) {
              logger.error('Detected anti-bot protection! Need to update scraping strategy.');
              break;
            }
            
            // Continue to try extracting listings anyway
          }
          
          // Extract listing data with more flexible selectors
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
                  
                  // Try multiple selectors for each field
                  
                  // Extract listing URL and auction ID
                  const linkSelectors = [
                    '.property-details a', 
                    'a.property-link', 
                    'a[href*="auction.com/details"]',
                    'a[data-testid="property-link"]',
                    'a[href*="/details/"]'
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
                    '.listing-address'
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
                    '.listing-location'
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
                    '.property-beds'
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
                    '.property-baths'
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
                    '.property-sqft'
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
                    '.current-bid'
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
                    '.property-auction-date'
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
                    '.property-auction-type'
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
                    '.listing-type'
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
                    'img[src*="auction.com"]'
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
          
          allListings.push(...pageListings);
          logger.info(`Extracted ${pageListings.length} listings from page ${pageNum}`);
          
          if (pageListings.length === 0) {
            logger.warn(`No listings found on page ${pageNum}. Possible website structure change.`);
          }
          
          // Try multiple selectors for pagination
          const nextButtonSelectors = [
            '.pagination-next:not(.disabled)', 
            '[data-testid="pagination-next"]', 
            'a.next-page',
            '.pagination .next',
            'button[aria-label="Next page"]'
          ];
          
          let nextButtonFound = false;
          for (const selector of nextButtonSelectors) {
            const nextButton = await this.page.$(selector);
            if (nextButton && pageNum < maxPages) {
              await nextButton.click();
              await this.randomDelay(3000, 5000); // Longer delay between page navigation
              nextButtonFound = true;
              break;
            }
          }
          
          if (!nextButtonFound && pageNum < maxPages) {
            logger.info('No next button found, reached last page or pagination structure changed');
            break;
          }
          
          // Wait for page to load after navigation
          await this.randomDelay(2000, 4000);
        }
      } catch (error) {
        logger.error(`Error scraping Auction.com for location ${location}:`, error);
      }
    }
    
    return allListings;
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
        'button:contains("Close")'
      ];
      
      for (const selector of popupSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            await element.click();
            logger.info(`Closed popup/overlay with selector: ${selector}`);
            await this.randomDelay(500, 1500);
          }
        } catch (e) {
          // Ignore errors for individual selectors
        }
      }
      
      try {
        // Check for and handle common captcha patterns
        const hasCaptcha = await this.page.evaluate(() => {
          return document.body.innerHTML.includes('captcha') || 
                document.body.innerHTML.includes('recaptcha') ||
                document.body.innerHTML.includes('I am not a robot');
        });
        
        if (hasCaptcha) {
          logger.warn('CAPTCHA detected - may need manual intervention');
          // Take a screenshot for debugging purposes
          await this.page.screenshot({ 
            path: `captcha-detected-${Date.now()}.png`,
            fullPage: false 
          });
        }
      } catch (e) {
        logger.error('Error checking for CAPTCHA:', e);
      }
      
    } catch (error) {
      logger.error('Error handling popups and overlays:', error);
    }
  }
  
  async getListingDetails(listingUrl: string): Promise<AuctionListing> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    try {
      // Use a longer timeout and wait for the page to be fully loaded
      await this.page.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.randomDelay(3000, 5000); // Longer delay to ensure page loads fully
      
      // Handle any popups or overlays
      await this.handlePopupsAndOverlays();
      
      // Wait for some content to be visible using multiple possible selectors
      try {
        await Promise.race([
          this.page.waitForSelector('.property-address', { timeout: 20000 }),
          this.page.waitForSelector('.property-details', { timeout: 20000 }),
          this.page.waitForSelector('.property-info', { timeout: 20000 }),
          this.page.waitForSelector('.property-content', { timeout: 20000 }),
        ]);
      } catch (error) {
        logger.warn(`Timed out waiting for detail selectors on ${listingUrl}. Continuing anyway.`);
        // Take screenshot for debugging
        await this.page.screenshot({ 
          path: `auction-details-error-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
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
          '.address-line'
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
          '.city-state-zip'
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
          '.listing-detail-item'
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
            const labelSelectors = ['.detail-label', '.label', '[data-testid="detail-label"]'];
            const valueSelectors = ['.detail-value', '.value', '[data-testid="detail-value"]'];
            
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
          '#property-description'
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
          '[data-testid="features-list"] li'
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
          'img.listing-image'
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

// Export singleton instances
export const auctionDotComScraper = new AuctionDotComScraper();

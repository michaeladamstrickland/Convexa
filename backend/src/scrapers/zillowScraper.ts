import puppeteer, { Browser, Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ScrapeResult, ScrapedProperty } from '../packages/schemas';

const prisma = new PrismaClient();

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

export class ZillowScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: process.env.PUPPETEER_HEADLESS === 'true',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
      });

      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      // Set viewport
      await this.page.setViewport({ width: 1366, height: 768 });

      logger.info('Puppeteer browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Browser closed successfully');
    }
  }

  private async randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async scrapeFSBOListings(
    zipCodes: string[] = ['07001', '07002', '07003'], // Default NJ zip codes
    maxPages: number = 5
  ): Promise<ZillowListing[]> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const allListings: ZillowListing[] = [];

    for (const zipCode of zipCodes) {
      logger.info(`Scraping FSBO listings for zip code: ${zipCode}`);
      
      try {
        // Navigate to Zillow FSBO search
        const searchUrl = `https://www.zillow.com/homes/for_sale/${zipCode}_rb/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22${zipCode}%22%2C%22mapBounds%22%3A%7B%7D%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A%22${zipCode}%22%2C%22regionType%22%3A7%7D%5D%2C%22isMapVisible%22%3Atrue%2C%22filterState%22%3A%7B%22fsbo%22%3A%7B%22value%22%3Atrue%7D%2C%22ah%22%3A%7B%22value%22%3Atrue%7D%7D%2C%22isListVisible%22%3Atrue%7D`;
        
        await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
        await this.randomDelay();

        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          logger.info(`Scraping page ${pageNum} for zip code ${zipCode}`);

          // Wait for listings to load
          await this.page.waitForSelector('[data-test="property-card"]', { timeout: 10000 });

          // Extract listing data
          const pageListings = await this.page.evaluate(() => {
            const listings: any[] = [];
            const propertyCards = document.querySelectorAll('[data-test="property-card"]');

            propertyCards.forEach((card) => {
              try {
                const listing: any = {};

                // Basic info
                const addressEl = card.querySelector('[data-test="property-card-addr"]');
                const priceEl = card.querySelector('[data-test="property-card-price"]');
                const detailsEl = card.querySelector('[data-test="property-card-details"]');
                const linkEl = card.querySelector('a[data-test="property-card-link"]');

                if (addressEl && priceEl && linkEl) {
                  const fullAddress = addressEl.textContent?.trim() || '';
                  const addressParts = fullAddress.split(', ');
                  
                  listing.address = addressParts[0] || '';
                  listing.city = addressParts[1] || '';
                  listing.state = addressParts[2]?.split(' ')[0] || '';
                  listing.zipCode = addressParts[2]?.split(' ')[1] || '';

                  // Price
                  const priceText = priceEl.textContent?.replace(/[^0-9]/g, '') || '0';
                  listing.price = parseInt(priceText);

                  // Property details
                  if (detailsEl) {
                    const detailsText = detailsEl.textContent || '';
                    const bedMatch = detailsText.match(/(\d+)\s*bd/);
                    const bathMatch = detailsText.match(/(\d+(?:\.\d+)?)\s*ba/);
                    const sqftMatch = detailsText.match(/([\d,]+)\s*sqft/);

                    if (bedMatch) listing.bedrooms = parseInt(bedMatch[1]);
                    if (bathMatch) listing.bathrooms = parseFloat(bathMatch[1]);
                    if (sqftMatch) listing.squareFootage = parseInt(sqftMatch[1].replace(/,/g, ''));
                  }

                  // URL and ID
                  listing.listingUrl = (linkEl as HTMLAnchorElement).href;
                  const urlMatch = listing.listingUrl.match(/\/homedetails\/.*\/(\d+)_zpid/);
                  listing.zillowId = urlMatch ? urlMatch[1] : '';

                  listing.propertyType = 'single_family'; // Default
                  listing.source = 'zillow_fsbo';

                  if (listing.address && listing.price > 0) {
                    listings.push(listing);
                  }
                }
              } catch (error) {
                console.error('Error extracting listing data:', error);
              }
            });

            return listings;
          });

          allListings.push(...pageListings);
          logger.info(`Extracted ${pageListings.length} listings from page ${pageNum}`);

          // Try to go to next page
          const nextButton = await this.page.$('[aria-label="Next page"]');
          if (nextButton && pageNum < maxPages) {
            await nextButton.click();
            await this.randomDelay(2000, 4000);
          } else {
            break;
          }
        }

        await this.randomDelay(3000, 5000); // Delay between zip codes
      } catch (error) {
        logger.error(`Error scraping zip code ${zipCode}:`, error);
      }
    }

    logger.info(`Total FSBO listings scraped: ${allListings.length}`);
    return allListings;
  }

  async scrapeListingDetails(listingUrl: string): Promise<Partial<ZillowListing>> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.goto(listingUrl, { waitUntil: 'networkidle2' });
      await this.randomDelay();

      const details = await this.page.evaluate(() => {
        const data: any = {};

        // Description
        const descEl = document.querySelector('[data-testid="home-description-text-description"]');
        if (descEl) {
          data.description = descEl.textContent?.trim();
        }

        // Property details
        const factsGrid = document.querySelector('[data-testid="home-facts-grid"]');
        if (factsGrid) {
          const yearBuiltEl = factsGrid.querySelector('span:contains("Year built")');
          if (yearBuiltEl) {
            const yearText = yearBuiltEl.parentElement?.textContent;
            const yearMatch = yearText?.match(/\d{4}/);
            if (yearMatch) data.yearBuilt = parseInt(yearMatch[0]);
          }

          const lotSizeEl = factsGrid.querySelector('span:contains("Lot size")');
          if (lotSizeEl) {
            const lotText = lotSizeEl.parentElement?.textContent;
            const lotMatch = lotText?.match(/([\d,\.]+)/);
            if (lotMatch) data.lotSize = parseFloat(lotMatch[1].replace(/,/g, ''));
          }
        }

        // Agent info
        const agentSection = document.querySelector('[data-testid="agent-section"]');
        if (agentSection) {
          data.agentInfo = {};
          
          const agentName = agentSection.querySelector('[data-testid="agent-name"]');
          if (agentName) data.agentInfo.name = agentName.textContent?.trim();

          const agentPhone = agentSection.querySelector('[data-testid="agent-phone"]');
          if (agentPhone) data.agentInfo.phone = agentPhone.textContent?.trim();
        }

        // Images
        const imageEls = document.querySelectorAll('[data-testid="property-image"] img');
        data.images = Array.from(imageEls).map((img: any) => img.src).slice(0, 10);

        return data;
      });

      return details;
    } catch (error) {
      logger.error(`Error scraping listing details for ${listingUrl}:`, error);
      return {};
    }
  }

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

  private generatePropertyHash(listing: ZillowListing): string {
    const key = `${listing.address}_${listing.city}_${listing.state}_${listing.zipCode}`;
    return Buffer.from(key.toLowerCase().replace(/\s+/g, '')).toString('base64');
  }

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

  // Adapter returning standardized ScrapeResult schema
  async runScrapeResult(zipCodes: string[], maxPages: number = 3): Promise<ScrapeResult> {
    const listings = await this.runFullScrape(zipCodes, maxPages);
    const items: ScrapedProperty[] = listings.map(l => ({
      sourceKey: 'zillow',
      capturedAt: new Date().toISOString(),
      address: { line1: l.address, city: l.city, state: l.state, zip: l.zipCode },
      priceHint: l.price,
      distressSignals: [],
      attributes: {
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        squareFootage: l.squareFootage,
        lotSize: l.lotSize,
        yearBuilt: l.yearBuilt,
        propertyType: l.propertyType
      }
    }));
    return { ok: true, items };
  }
}

// Export singleton instance
export const zillowScraper = new ZillowScraper();

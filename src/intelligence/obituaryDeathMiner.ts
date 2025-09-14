import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { DeathIntelligence, FamilyMember, PropertyLink, ContactInfo, VacancySignal } from '../types/index';

export class ObituaryDeathMiner {
  private openai: OpenAI;
  private sources = [
    'legacy.com',
    'newspapers.com', 
    'find-a-grave.com',
    'tributes.com',
    'local_funeral_homes',
    'obituary_daily.com'
  ];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async mineDeathIntelligence(markets: string[]): Promise<DeathIntelligence[]> {
    console.log(`🔍 Starting death intelligence mining for ${markets.length} markets...`);
    
    const deathRecords = await Promise.all([
      this.scrapeLegacyDotCom(markets),
      this.scrapeLocalNewspapers(markets),
      this.scrapeFuneralHomes(markets),
      this.parseObituaryFeeds(markets)
    ]);

    const consolidatedDeaths = this.consolidateDeathRecords(deathRecords.flat());
    const enrichedDeaths = await this.enrichWithPropertyIntelligence(consolidatedDeaths);
    
    console.log(`✅ Found ${enrichedDeaths.length} high-value death intelligence records`);
    return enrichedDeaths;
  }

  private async scrapeLegacyDotCom(markets: string[]): Promise<any[]> {
    console.log('🕷️ Scraping Legacy.com obituaries...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const obituaries = [];

    try {
      for (const market of markets) {
        await page.goto(`https://www.legacy.com/us/obituaries/local/${market.toLowerCase()}`, {
          waitUntil: 'networkidle2'
        });

        await page.waitForSelector('.obit-item', { timeout: 10000 });
        
        const marketObituaries = await page.evaluate(() => {
          const obituaryElements = document.querySelectorAll('.obit-item');
          return Array.from(obituaryElements).map((element: Element) => {
            const nameElement = element.querySelector('.obit-name');
            const dateElement = element.querySelector('.obit-date');
            const ageElement = element.querySelector('.obit-age');
            const locationElement = element.querySelector('.obit-location');
            const linkElement = element.querySelector('a');
            
            return {
              name: nameElement?.textContent?.trim() || '',
              death_date: dateElement?.textContent?.trim() || '',
              age: ageElement?.textContent?.trim() || '',
              location: locationElement?.textContent?.trim() || '',
              obituary_url: linkElement?.getAttribute('href') || '',
              source: 'legacy.com'
            };
          });
        });

        obituaries.push(...marketObituaries);
        
        // Respectful delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Error scraping Legacy.com:', error);
    } finally {
      await browser.close();
    }

    return obituaries;
  }

  private async scrapeLocalNewspapers(markets: string[]): Promise<any[]> {
    console.log('📰 Scraping local newspaper obituaries...');
    const obituaries = [];
    
    // Common newspaper obituary URL patterns
    const newspaperPatterns = [
      'obituaries',
      'obits',
      'death-notices',
      'memorials'
    ];

    for (const market of markets) {
      try {
        // Try to find local newspaper websites
        const searchQuery = `${market} newspaper obituaries site:*.com`;
        const searchResults = await this.searchForNewspaperSites(searchQuery);
        
        for (const site of searchResults.slice(0, 3)) { // Limit to top 3 sites per market
          const siteObituaries = await this.scrapeNewspaperSite(site);
          obituaries.push(...siteObituaries);
          
          // Respectful delay
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`Error scraping newspapers for ${market}:`, error);
      }
    }

    return obituaries;
  }

  private async scrapeNewspaperSite(siteUrl: string): Promise<any[]> {
    try {
      const response = await axios.get(siteUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const obituaries: any[] = [];

      // Common selectors for obituary listings
      const selectors = [
        '.obituary',
        '.obit',
        '.death-notice',
        '[class*="obituary"]',
        '[class*="obit"]'
      ];

      for (const selector of selectors) {
        $(selector).each((index, element) => {
          const $el = $(element);
          const name = $el.find('h1, h2, h3, .name, .title').first().text().trim();
          const date = this.extractDate($el.text());
          
          if (name && date) {
            obituaries.push({
              name: name,
              death_date: date,
              obituary_text: $el.text().trim(),
              source: siteUrl,
              location: this.extractLocation($el.text())
            });
          }
        });
      }

      return obituaries;
    } catch (error) {
      console.error(`Error scraping ${siteUrl}:`, error);
      return [];
    }
  }

  private async scrapeFuneralHomes(markets: string[]): Promise<any[]> {
    console.log('⚱️ Scraping funeral home obituaries...');
    const obituaries = [];

    for (const market of markets) {
      try {
        // Search for local funeral homes
        const funeralHomes = await this.findLocalFuneralHomes(market);
        
        for (const funeralHome of funeralHomes.slice(0, 5)) { // Top 5 per market
          const homeObituaries = await this.scrapeFuneralHomeSite(funeralHome);
          obituaries.push(...homeObituaries);
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error scraping funeral homes for ${market}:`, error);
      }
    }

    return obituaries;
  }

  private async parseObituaryFeeds(markets: string[]): Promise<any[]> {
    console.log('📡 Parsing obituary RSS feeds...');
    const obituaries = [];

    // Common RSS feed patterns for obituaries
    const feedPatterns = [
      '/obituaries/feed',
      '/obits/rss',
      '/rss/obituaries',
      '/feed/obituaries'
    ];

    for (const market of markets) {
      try {
        const feeds = await this.findObituaryFeeds(market);
        
        for (const feed of feeds) {
          const feedObituaries = await this.parseRSSFeed(feed);
          obituaries.push(...feedObituaries);
        }
      } catch (error) {
        console.error(`Error parsing feeds for ${market}:`, error);
      }
    }

    return obituaries;
  }

  private consolidateDeathRecords(allRecords: any[]): any[] {
    console.log('🔄 Consolidating death records...');
    const consolidated = new Map();

    for (const record of allRecords) {
      if (!record.name || record.name.length < 3) continue;
      
      const key = this.createRecordKey(record.name, record.death_date);
      
      if (consolidated.has(key)) {
        // Merge records for the same person
        const existing = consolidated.get(key);
        consolidated.set(key, this.mergeRecords(existing, record));
      } else {
        consolidated.set(key, record);
      }
    }

    return Array.from(consolidated.values());
  }

  private async enrichWithPropertyIntelligence(deaths: any[]): Promise<DeathIntelligence[]> {
    console.log('🏠 Enriching deaths with property intelligence...');
    const enrichedDeaths = [];
    
    for (const death of deaths) {
      try {
        // Cross-reference with property records
        const properties = await this.findDeceasedProperties(death.name, death.last_known_address);
        
        // Skip if no properties found
        if (!properties || properties.length === 0) continue;
        
        // AI-powered heir identification
        const heirs = await this.identifyHeirs(death.obituary_text, death.survivors);
        
        // Skip trace heir contact information
        const heirContacts = await this.skipTraceHeirs(heirs);
        
        // Vacancy correlation analysis
        const vacancySignals = await this.detectPostDeathVacancy(properties);
        
        // Estate value estimation
        const estateValue = this.estimateEstateValue(properties);
        
        // Only include high-value prospects
        if (estateValue >= 100000) {
          enrichedDeaths.push({
            deceased_name: death.name,
            death_date: new Date(death.death_date),
            family_members: heirs,
            property_links: properties,
            estate_value_estimate: estateValue,
            probate_filing_probability: this.calculateProbateFilingProbability(death, estateValue),
            heir_contact_data: heirContacts,
            vacancy_indicators: vacancySignals,
            last_known_address: death.location,
            obituary_text: death.obituary_text,
            age_at_death: this.extractAge(death.age || death.obituary_text)
          });
        }
      } catch (error) {
        console.error(`Error enriching death record for ${death.name}:`, error);
      }
    }
    
    return enrichedDeaths.filter(death => 
      death.estate_value_estimate >= 100000 && 
      death.probate_filing_probability >= 0.3
    );
  }

  private async identifyHeirs(obituaryText: string, survivors: string[]): Promise<FamilyMember[]> {
    if (!obituaryText && (!survivors || survivors.length === 0)) {
      return [];
    }

    const prompt = `
    Analyze this obituary text and identify potential property heirs:
    
    OBITUARY: "${obituaryText}"
    SURVIVORS: ${survivors ? survivors.join(', ') : 'Not specified'}
    
    Extract and classify family members by relationship and likelihood to inherit property:
    - Spouse (highest priority)
    - Adult children (high priority) 
    - Siblings (medium priority)
    - Other relatives (low priority)
    
    For each person, extract: name, relationship, age (if mentioned), location.
    Return JSON array with inheritance_priority (1-10 scale).
    
    Example format:
    [
      {
        "name": "John Smith",
        "relationship": "spouse",
        "age": 65,
        "location": "Same city",
        "inheritance_priority": 10
      }
    ]
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });

      const content = response.choices[0].message.content || '[]';
      return JSON.parse(content);
    } catch (error) {
      console.error('Error identifying heirs:', error);
      return [];
    }
  }

  private async findDeceasedProperties(name: string, lastKnownAddress?: string): Promise<PropertyLink[]> {
    // This would integrate with property record APIs
    // For now, return mock data structure
    return [
      {
        address: lastKnownAddress || `123 Example St, City, State`,
        estimated_value: 250000,
        equity: 200000,
        condition: 'fair',
        bedrooms: 3,
        bathrooms: 2,
        square_feet: 1800,
        year_built: 1995,
        property_type: 'Single Family',
        vacancy_probability: 85,
        deed_type: 'Warranty Deed',
        mortgage_balance: 50000
      }
    ];
  }

  private async skipTraceHeirs(heirs: FamilyMember[]): Promise<ContactInfo[]> {
    // This would integrate with skip tracing services
    // For now, return mock structure
    return heirs.map(heir => ({
      type: 'phone' as const,
      value: `555-${Math.floor(Math.random() * 9000) + 1000}`,
      confidence_score: 75,
      source: 'skip_trace_service'
    }));
  }

  private async detectPostDeathVacancy(properties: PropertyLink[]): Promise<VacancySignal[]> {
    // This would check utility records, mail delivery, etc.
    return [
      {
        indicator_type: 'utility_disconnect',
        confidence_score: 80,
        detected_date: new Date(),
        description: 'Utility usage dropped to zero post-death'
      }
    ];
  }

  private estimateEstateValue(properties: PropertyLink[]): number {
    return properties.reduce((total, property) => total + property.estimated_value, 0);
  }

  private calculateProbateFilingProbability(death: any, estateValue: number): number {
    let probability = 0;
    
    // Estate value impact
    if (estateValue > 500000) probability += 0.8;
    else if (estateValue > 250000) probability += 0.6;
    else if (estateValue > 100000) probability += 0.4;
    else probability += 0.2;
    
    // Age impact (older people more likely to have wills/probate)
    const age = this.extractAge(death.age || death.obituary_text);
    if (age > 70) probability += 0.1;
    else if (age > 60) probability += 0.05;
    
    return Math.min(probability, 1.0);
  }

  // Helper methods
  private createRecordKey(name: string, date: string): string {
    return `${name.toLowerCase().replace(/[^a-z]/g, '')}_${date}`;
  }

  private mergeRecords(existing: any, newRecord: any): any {
    return {
      ...existing,
      obituary_text: existing.obituary_text || newRecord.obituary_text,
      location: existing.location || newRecord.location,
      sources: [...(existing.sources || [existing.source]), newRecord.source]
    };
  }

  private extractDate(text: string): string | null {
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
      /\b\d{1,2}-\d{1,2}-\d{4}\b/,
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    
    return null;
  }

  private extractLocation(text: string): string | null {
    // Simple location extraction - could be enhanced with NLP
    const locationPatterns = [
      /of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})/,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) return `${match[1]}, ${match[2]}`;
    }
    
    return null;
  }

  private extractAge(text: string): number {
    const agePattern = /\b(\d{1,3})\s*(?:years?\s*old|age)\b/i;
    const match = text?.match(agePattern);
    return match ? parseInt(match[1]) : 0;
  }

  private async searchForNewspaperSites(query: string): Promise<string[]> {
    // This would use a search API to find newspaper sites
    // For now, return common newspaper domain patterns
    return [
      'example-newspaper.com',
      'local-news.com',
      'city-herald.com'
    ];
  }

  private async findLocalFuneralHomes(market: string): Promise<string[]> {
    // This would search for funeral homes in the area
    return [
      `${market.toLowerCase()}-funeral.com`,
      `memorial-${market.toLowerCase()}.com`
    ];
  }

  private async scrapeFuneralHomeSite(siteUrl: string): Promise<any[]> {
    // Implementation for funeral home scraping
    return [];
  }

  private async findObituaryFeeds(market: string): Promise<string[]> {
    // Find RSS feeds for obituaries in the market
    return [];
  }

  private async parseRSSFeed(feedUrl: string): Promise<any[]> {
    // Parse RSS feed for obituaries
    return [];
  }

  // Main execution method for testing
  async executeMining(markets: string[] = ['Chicago', 'Phoenix', 'Dallas']): Promise<void> {
    console.log('🚀 STARTING OBITUARY DEATH MINING ENGINE');
    console.log('=======================================');
    
    const startTime = Date.now();
    const deathIntelligence = await this.mineDeathIntelligence(markets);
    const endTime = Date.now();
    
    console.log('\n📊 MINING RESULTS:');
    console.log(`⏱️  Processing Time: ${(endTime - startTime) / 1000}s`);
    console.log(`🎯 High-Value Prospects: ${deathIntelligence.length}`);
    console.log(`💰 Total Estate Value: $${deathIntelligence.reduce((sum, death) => sum + death.estate_value_estimate, 0).toLocaleString()}`);
    
    // Display top prospects
    console.log('\n🏆 TOP PROSPECTS:');
    deathIntelligence
      .sort((a, b) => b.estate_value_estimate - a.estate_value_estimate)
      .slice(0, 5)
      .forEach((death, index) => {
        console.log(`${index + 1}. ${death.deceased_name}`);
        console.log(`   💰 Estate Value: $${death.estate_value_estimate.toLocaleString()}`);
        console.log(`   🏠 Properties: ${death.property_links.length}`);
        console.log(`   👥 Heirs: ${death.family_members.length}`);
        console.log(`   📈 Probate Probability: ${(death.probate_filing_probability * 100).toFixed(1)}%`);
        console.log('');
      });
  }
}

// Direct execution disabled in ESM build to avoid require/import.meta guard complexity.

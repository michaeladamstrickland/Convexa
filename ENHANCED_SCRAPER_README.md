# FlipTracker Enhanced Scraper Framework

This folder contains the enhanced scraping framework for the FlipTracker application. These enhancements build on the original scrapers while adding standardized output formats, data normalization, and lead scoring capabilities.

## Implemented Enhancements

### 1. Standardized Output Contracts (`src/types/ScrapeResult.ts`)
- Defined TypeScript interfaces for scraped properties
- Created consistent output format for all scrapers
- Added support for distress signals, contacts, and attachments

### 2. Address and Owner Normalization (`src/lib/normalize.js`)
- Basic address normalization (placeholder for libpostal)
- Owner name normalization with business entity handling
- Address hashing for deduplication

### 3. Enhanced Scraper Base (`src/scraping/enhanced-scraper-base.js`)
- Extends the original ScraperBase
- Automatically standardizes output to match the ScrapeResult format
- Extracts contacts and attachments

### 4. Lead Scoring (`src/scoring/leadScore.js`)
- Scores properties based on distress signals
- Considers factors like equity, recency, and owner occupancy
- Assigns temperature categories (Dead, Warm, Hot, On Fire)

### 5. Enhanced Cook County Scraper Example (`src/scrapers/cook-county-enhanced.js`)
- Example of adapting an existing scraper to the new framework
- Includes additional fields for better distress signal detection

## Getting Started

### Installation

1. Install basic dependencies:
   ```bash
   npm install --save cheerio crypto
   ```

2. Run the basic test:
   ```bash
   node test-normalize-score.cjs
   ```

### Optional Advanced Features

For address normalization with libpostal:
```bash
npm install --save node-postal
```

For Playwright integration (replaces Puppeteer):
```bash
npm install --save playwright
```

## Next Steps

1. **Playwright Integration**: Replace Puppeteer with Playwright for better anti-bot capabilities
2. **Full libpostal Integration**: Add proper address parsing and normalization
3. **Data Fusion & Deduplication**: Implement property record merging
4. **API Endpoint**: Create `/scrape/intake` endpoint for batch processing
5. **UI Hooks**: Surface temperature and distress signals in the UI

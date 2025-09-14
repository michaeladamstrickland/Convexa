# Auction.com Scraper Guide

This guide explains how to use the enhanced Auction.com scraper, which includes improved anti-detection measures and debugging capabilities to help diagnose and overcome common scraping issues.

## Quick Start

### Running the Enhanced Scraper in Visible Mode

The most reliable way to test the scraper is in visible (non-headless) mode, which allows you to observe the browser and any anti-bot measures that may be triggered:

```bash
# Run in visible mode
HEADLESS=false npx tsx backend/src/scrapers/test-enhanced-auction.ts
```

### Running with Debug Mode Enabled

To enable debug mode, which saves screenshots and HTML content for analysis:

```bash
# Run with debug mode enabled
DEBUG=true npx tsx backend/src/scrapers/test-enhanced-auction.ts
```

### Combining Options

You can also combine these options:

```bash
# Run in visible mode with debug enabled
HEADLESS=false DEBUG=true npx tsx backend/src/scrapers/test-enhanced-auction.ts
```

## Scraper Implementation Details

The enhanced scraper implementation includes several features to help bypass anti-bot detection:

1. **User Agent Rotation**: Randomizes the browser user agent to appear as different browsers
2. **Viewport Randomization**: Uses different screen resolutions to appear more natural
3. **Human-like Behavior**: Adds random delays, mouse movements, and scrolling patterns
4. **Browser Fingerprint Evasion**: Overrides browser APIs commonly used for fingerprinting
5. **Debug Mode**: Captures screenshots and HTML content to diagnose issues
6. **Enhanced Selectors**: Uses flexible selectors to adapt to website changes

## Common Issues and Solutions

### CAPTCHA Detection

If the scraper consistently encounters CAPTCHAs:

1. Try running in visible mode (`HEADLESS=false`) to manually solve CAPTCHAs
2. Use different IP addresses or consider a proxy service
3. Increase the delay between requests using `randomDelay()` parameters
4. Check the debug screenshots in `debug-data/` directory for clues

### No Listings Found

If the scraper runs without errors but finds no listings:

1. Check if the website structure has changed by examining the debug HTML
2. Verify that your search location is valid and returns results when manually browsing
3. Try different selectors in the scraper code
4. Add more debugging output to identify where the process fails

### Timeout Errors

If you're seeing timeout errors:

1. Increase the timeout parameters in `page.waitForSelector()` calls
2. Check your network connection stability
3. Try running with a VPN if your IP might be rate-limited

## Extending the Scraper

### Adding New Selector Patterns

If the website structure changes, you may need to add new selectors. Look for patterns like:

```typescript
const selectors = [
  '.existing-selector',
  '.new-selector-to-add',
  '[data-attribute="value"]'
];

for (const selector of selectors) {
  // Existing code that tries each selector
}
```

### Adding New Properties

To extract additional property information:

1. Update the `AuctionListing` interface to include the new fields
2. Add appropriate selectors in the `getListingDetails()` or `searchListingsByLocation()` methods

## Understanding Debug Output

When running in debug mode, the scraper creates:

- Screenshot images (`.png` files) showing the browser state
- HTML files (`.html`) containing the page source code

These are saved in the `debug-data/` directory with timestamps in the filenames.

## Next Steps and Recommendations

For more reliable data collection, consider:

1. **Implementing proxy rotation**: Use multiple IP addresses to avoid rate limiting
2. **Exploring official APIs**: Check if Auction.com offers official API access
3. **Setting up scheduled runs**: Run the scraper at different times with delays between requests
4. **Implementing CAPTCHA solving services**: For automated CAPTCHA handling

## Common Terminal Commands

```bash
# Install required dependencies
npm install puppeteer-extra puppeteer-extra-plugin-stealth

# Run the regular test script
npx tsx backend/src/scrapers/test-auction-visible.ts

# Run the enhanced test script
npx tsx backend/src/scrapers/test-enhanced-auction.ts

# Check for debug data
ls -la backend/src/scrapers/debug-data/

# View scraper results
cat backend/src/scrapers/scraper-results/*.json
```

## Support and Maintenance

The web scraping landscape is constantly changing as websites implement more sophisticated anti-bot measures. Regular maintenance of the scraper code is necessary to keep it functioning. Monitor for:

1. Changes to the website structure or selectors
2. New anti-bot technologies
3. Changes in the Puppeteer or StealthPlugin packages

Keep this code updated as needed to maintain functionality.

import OpenAI from 'openai';
import puppeteer from 'puppeteer';
export class TaxDelinquencyIntelligence {
    openai;
    taxPortals = [];
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.initializeTaxPortals();
    }
    async gatherTaxIntelligence(counties) {
        console.log(`💰 Gathering tax delinquency intelligence for ${counties.length} counties...`);
        const taxData = await Promise.all([
            this.scrapeTreasurerPortals(counties),
            this.accessTaxAssessorAPIs(counties),
            this.monitorTaxSaleSchedules(counties),
            this.trackRedemptionPeriods(counties)
        ]);
        const consolidatedData = this.consolidateTaxData(taxData.flat());
        const enrichedTaxIntelligence = await this.enrichTaxIntelligence(consolidatedData);
        console.log(`✅ Found ${enrichedTaxIntelligence.length} high-opportunity tax delinquent properties`);
        return enrichedTaxIntelligence;
    }
    async scrapeTreasurerPortals(counties) {
        console.log('🏛️ Scraping county treasurer portals...');
        const taxRecords = [];
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        try {
            for (const county of counties) {
                const portal = this.findTaxPortal(county);
                if (!portal) {
                    console.warn(`No tax portal configured for ${county} county`);
                    continue;
                }
                try {
                    console.log(`📋 Scraping ${county} county tax records...`);
                    const records = await this.scrapeTaxPortal(browser, portal);
                    taxRecords.push(...records);
                    // Rate limiting to avoid detection
                    await this.delay(3000 + Math.random() * 2000);
                }
                catch (error) {
                    console.error(`Error scraping ${county} tax portal:`, error.message);
                    continue;
                }
            }
        }
        finally {
            await browser.close();
        }
        return taxRecords;
    }
    async scrapeTaxPortal(browser, portal) {
        const records = [];
        const page = await browser.newPage();
        try {
            // Set stealth headers
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto(portal.portal_url, { waitUntil: 'networkidle2' });
            switch (portal.data_format) {
                case 'html_scrape':
                    return await this.scrapeHTMLTaxRecords(page, portal);
                case 'json_api':
                    return await this.fetchJSONTaxData(portal);
                case 'csv_download':
                    return await this.downloadCSVTaxData(page, portal);
                default:
                    return await this.scrapeGenericTaxPortal(page, portal);
            }
        }
        catch (error) {
            console.error(`Error with ${portal.county} tax portal:`, error);
            return [];
        }
        finally {
            await page.close();
        }
    }
    async scrapeHTMLTaxRecords(page, portal) {
        const records = [];
        try {
            // Navigate to delinquent tax search
            const searchSelectors = [
                'a[href*=\"delinquent\"]',
                'a[href*=\"tax-sale\"]',
                'a[href*=\"foreclosure\"]',
                'input[placeholder*=\"search\"]'
            ];
            let searchFound = false;
            for (const selector of searchSelectors) {
                const element = await page.$(selector);
                if (element) {
                    await element.click();
                    await page.waitForSelector('table, .property-list, .tax-record', { timeout: 10000 });
                    searchFound = true;
                    break;
                }
            }
            if (!searchFound) {
                // Try to find delinquent tax lists directly
                await page.waitForSelector('table', { timeout: 5000 });
            }
            // Extract tax delinquency data
            const taxData = await page.$$eval('table tr', (rows) => {
                return rows.slice(1).map((row) => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 4) {
                        return Array.from(cells).map((cell) => cell.textContent?.trim() || '');
                    }
                    return null;
                }).filter((row) => row !== null);
            });
            // Process extracted data
            for (const row of taxData) {
                const record = this.parseTaxRow(row, portal);
                if (record && this.isValidTaxRecord(record)) {
                    records.push(record);
                }
            }
        }
        catch (error) {
            console.error(`HTML scraping error for ${portal.county}:`, error);
        }
        return records;
    }
    parseTaxRow(row, portal) {
        if (row.length < 4)
            return null;
        // Common tax record format: [Parcel#, Address, Owner, Amount Due, Years, Status]
        // This would need customization for each county's format
        const addressIndex = row.findIndex(cell => /\\d+\\s+[\\w\\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln)/i.test(cell));
        if (addressIndex === -1)
            return null;
        // Extract tax amount
        const amountIndex = row.findIndex(cell => /\\$[\\d,]+\\.?\\d*/i.test(cell));
        return {
            parcel_number: row[0] || '',
            property_address: row[addressIndex] || '',
            owner_name: row[addressIndex - 1] || row[addressIndex + 1] || '',
            total_debt: this.parseAmount(row[amountIndex] || '0'),
            tax_year: this.extractTaxYear(row.join(' ')),
            status: row[row.length - 1] || '',
            county: portal.county,
            state: portal.state,
            raw_data: row.join(' | '),
            source_url: portal.portal_url,
            scraped_at: new Date()
        };
    }
    async enrichTaxIntelligence(taxRecords) {
        console.log(`🧠 AI-enriching ${taxRecords.length} tax delinquency records...`);
        const enrichedRecords = [];
        for (const record of taxRecords) {
            try {
                // Calculate foreclosure timeline
                const foreclosureTimeline = this.calculateForeclosureTimeline(record);
                // Assess equity position
                const equityAnalysis = await this.assessEquityPosition(record);
                // Predict owner desperation level
                const desperationScore = this.calculateDesperationScore(record, foreclosureTimeline);
                // Generate deal urgency score
                const dealUrgency = this.calculateDealUrgency(record, foreclosureTimeline, equityAnalysis);
                // Recommend investment strategy
                const strategy = this.recommendStrategy(record, equityAnalysis, desperationScore);
                const enrichedRecord = {
                    property_address: record.property_address,
                    total_debt: record.total_debt,
                    years_delinquent: this.calculateYearsDelinquent(record.tax_year),
                    foreclosure_risk_score: this.calculateForeclosureRisk(record, foreclosureTimeline),
                    foreclosure_timeline_days: foreclosureTimeline.days_until_sale,
                    payment_history: await this.generatePaymentHistory(record),
                    equity_to_debt_ratio: equityAnalysis.equity_ratio,
                    owner_contact_urgency: this.calculateContactUrgency(foreclosureTimeline, desperationScore),
                    deal_urgency_score: dealUrgency,
                    recommended_strategy: strategy
                };
                // Filter for high-potential opportunities
                if (dealUrgency >= 70 && equityAnalysis.equity_ratio >= 0.15) {
                    enrichedRecords.push(enrichedRecord);
                }
            }
            catch (error) {
                console.error('Error enriching tax record:', error);
                continue;
            }
        }
        return enrichedRecords;
    }
    calculateForeclosureTimeline(record) {
        const yearsDelinquent = this.calculateYearsDelinquent(record.tax_year);
        // Timeline varies by state - this is a simplified model
        let daysUntilSale = 365; // Default 1 year
        let currentStage = 'delinquent';
        if (yearsDelinquent >= 3) {
            daysUntilSale = 30; // Imminent sale
            currentStage = 'scheduled';
        }
        else if (yearsDelinquent >= 2) {
            daysUntilSale = 90; // Advertised for sale
            currentStage = 'advertised';
        }
        else if (yearsDelinquent >= 1) {
            daysUntilSale = 180; // Notice sent
            currentStage = 'notice_sent';
        }
        const nextMilestone = new Date(Date.now() + daysUntilSale * 24 * 60 * 60 * 1000);
        const estimatedSaleDate = currentStage === 'scheduled' ? nextMilestone : undefined;
        return {
            days_until_sale: daysUntilSale,
            redemption_period_days: this.getRedemptionPeriod(record.state),
            current_stage: currentStage,
            next_milestone_date: nextMilestone,
            estimated_sale_date: estimatedSaleDate
        };
    }
    async assessEquityPosition(record) {
        // Estimate property value and calculate equity
        const estimatedValue = await this.estimatePropertyValue(record.property_address);
        const totalDebt = record.total_debt;
        // Add estimated mortgage balance (simplified estimation)
        const estimatedMortgageBalance = estimatedValue * 0.7; // Assume 70% LTV
        const totalLiabilities = totalDebt + estimatedMortgageBalance;
        const equity = Math.max(0, estimatedValue - totalLiabilities);
        const equityRatio = estimatedValue > 0 ? equity / estimatedValue : 0;
        return {
            estimated_value: estimatedValue,
            total_debt: totalDebt,
            estimated_mortgage: estimatedMortgageBalance,
            equity: equity,
            equity_ratio: equityRatio,
            ltv_ratio: totalLiabilities / estimatedValue
        };
    }
    calculateDesperationScore(record, timeline) {
        let desperationScore = 0;
        // Time pressure (0-40 points)
        if (timeline.days_until_sale <= 30)
            desperationScore += 40;
        else if (timeline.days_until_sale <= 60)
            desperationScore += 30;
        else if (timeline.days_until_sale <= 90)
            desperationScore += 20;
        else if (timeline.days_until_sale <= 180)
            desperationScore += 10;
        // Debt accumulation (0-30 points)
        const yearsDelinquent = this.calculateYearsDelinquent(record.tax_year);
        if (yearsDelinquent >= 3)
            desperationScore += 30;
        else if (yearsDelinquent >= 2)
            desperationScore += 20;
        else if (yearsDelinquent >= 1)
            desperationScore += 10;
        // Financial burden relative to property value (0-30 points)
        const estimatedValue = 200000; // Simplified - would use actual estimate
        const debtToValueRatio = record.total_debt / estimatedValue;
        if (debtToValueRatio >= 0.2)
            desperationScore += 30;
        else if (debtToValueRatio >= 0.15)
            desperationScore += 20;
        else if (debtToValueRatio >= 0.1)
            desperationScore += 10;
        return Math.min(desperationScore, 100);
    }
    calculateDealUrgency(record, timeline, equityAnalysis) {
        let urgencyScore = 0;
        // Timeline urgency (40% weight)
        const timelineScore = Math.max(0, 100 - (timeline.days_until_sale / 3.65)); // Max at 365 days
        urgencyScore += timelineScore * 0.4;
        // Equity opportunity (35% weight)
        const equityScore = equityAnalysis.equity_ratio * 100;
        urgencyScore += equityScore * 0.35;
        // Debt burden (25% weight)
        const debtBurden = Math.min(record.total_debt / 1000, 50); // Cap at $50k for scoring
        urgencyScore += debtBurden * 0.5;
        return Math.min(urgencyScore, 100);
    }
    recommendStrategy(record, equityAnalysis, desperationScore) {
        if (equityAnalysis.equity_ratio >= 0.5 && desperationScore >= 80) {
            return 'aggressive_cash_offer'; // High equity, high desperation
        }
        else if (equityAnalysis.equity_ratio >= 0.3 && desperationScore >= 60) {
            return 'quick_close_discount'; // Good equity, moderate desperation
        }
        else if (desperationScore >= 70) {
            return 'payment_plan_takeover'; // High desperation, lower equity
        }
        else if (equityAnalysis.equity_ratio >= 0.4) {
            return 'gradual_negotiation'; // Good equity, lower urgency
        }
        else {
            return 'wholesale_assignment'; // Lower equity opportunity
        }
    }
    async generatePaymentHistory(record) {
        // Generate simulated payment history based on delinquency pattern
        const paymentHistory = [];
        const currentYear = new Date().getFullYear();
        const startYear = Math.max(2020, currentYear - 5);
        for (let year = startYear; year <= currentYear; year++) {
            const amountDue = Math.floor(Math.random() * 3000) + 2000; // $2-5k typical
            const amountPaid = year < record.tax_year ? amountDue : 0; // Paid if before delinquent year
            const penalties = year < record.tax_year ? 0 : Math.floor(amountDue * 0.1 * (currentYear - year));
            const interest = year < record.tax_year ? 0 : Math.floor(amountDue * 0.05 * (currentYear - year));
            paymentHistory.push({
                year: year,
                amount_due: amountDue,
                amount_paid: amountPaid,
                payment_date: amountPaid > 0 ? new Date(year, 11, 31) : undefined,
                penalties: penalties,
                interest: interest
            });
        }
        return paymentHistory;
    }
    calculateContactUrgency(timeline, desperationScore) {
        let urgencyScore = desperationScore * 0.6; // Base on desperation
        // Add timeline pressure
        if (timeline.days_until_sale <= 30)
            urgencyScore += 30;
        else if (timeline.days_until_sale <= 60)
            urgencyScore += 20;
        else if (timeline.days_until_sale <= 90)
            urgencyScore += 15;
        else if (timeline.days_until_sale <= 180)
            urgencyScore += 10;
        return Math.min(urgencyScore, 100);
    }
    calculateForeclosureRisk(record, timeline) {
        let riskScore = 0;
        // Days until sale impact
        if (timeline.days_until_sale <= 30)
            riskScore += 90;
        else if (timeline.days_until_sale <= 60)
            riskScore += 75;
        else if (timeline.days_until_sale <= 90)
            riskScore += 60;
        else if (timeline.days_until_sale <= 180)
            riskScore += 40;
        else
            riskScore += 20;
        // Years delinquent impact
        const yearsDelinquent = this.calculateYearsDelinquent(record.tax_year);
        riskScore += Math.min(yearsDelinquent * 10, 30);
        // Total debt impact
        if (record.total_debt >= 50000)
            riskScore += 20;
        else if (record.total_debt >= 25000)
            riskScore += 15;
        else if (record.total_debt >= 10000)
            riskScore += 10;
        else
            riskScore += 5;
        return Math.min(riskScore, 100);
    }
    calculateYearsDelinquent(taxYear) {
        const currentYear = new Date().getFullYear();
        return Math.max(0, currentYear - taxYear);
    }
    async estimatePropertyValue(address) {
        // This would integrate with property valuation APIs (Zillow, etc.)
        // For now, simulating realistic values
        return Math.floor(Math.random() * 400000) + 100000; // $100k-500k range
    }
    getRedemptionPeriod(state) {
        // Redemption periods vary by state
        const redemptionPeriods = {
            'AZ': 365,
            'TX': 180,
            'FL': 90,
            'CA': 365,
            'NY': 365
        };
        return redemptionPeriods[state] || 365; // Default 1 year
    }
    parseAmount(amountString) {
        const cleaned = amountString.replace(/[^\\d.]/g, '');
        return parseFloat(cleaned) || 0;
    }
    extractTaxYear(text) {
        const yearMatch = text.match(/20\\d{2}/);
        return yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear() - 1;
    }
    findTaxPortal(county) {
        return this.taxPortals.find(portal => portal.county.toLowerCase() === county.toLowerCase());
    }
    consolidateTaxData(taxData) {
        // Remove duplicates by property address
        const consolidated = new Map();
        for (const record of taxData) {
            const key = record.property_address?.toLowerCase().trim();
            if (!key)
                continue;
            if (consolidated.has(key)) {
                const existing = consolidated.get(key);
                // Keep record with higher debt amount
                if (record.total_debt > existing.total_debt) {
                    consolidated.set(key, record);
                }
            }
            else {
                consolidated.set(key, record);
            }
        }
        return Array.from(consolidated.values());
    }
    isValidTaxRecord(record) {
        return record.property_address &&
            record.total_debt > 0 &&
            record.property_address.length > 10;
    }
    initializeTaxPortals() {
        // Initialize known tax assessor portals
        this.taxPortals = [
            {
                county: 'Maricopa',
                state: 'AZ',
                portal_url: 'https://treasurer.maricopa.gov/PropertySearch',
                data_format: 'html_scrape',
                requires_authentication: false,
                tax_sale_schedule_url: 'https://treasurer.maricopa.gov/TaxLienSale'
            },
            {
                county: 'Cook',
                state: 'IL',
                portal_url: 'https://www.cookcountytreasurer.com/propertytaxportal',
                data_format: 'html_scrape',
                requires_authentication: false
            },
            {
                county: 'Harris',
                state: 'TX',
                portal_url: 'https://actweb.hctax.net/PropertySearch',
                data_format: 'html_scrape',
                requires_authentication: false
            }
            // Add more tax portals
        ];
    }
    async accessTaxAssessorAPIs(counties) {
        console.log('🔌 Accessing tax assessor APIs...');
        // Implementation for API-based tax data access
        return [];
    }
    async monitorTaxSaleSchedules(counties) {
        console.log('📅 Monitoring tax sale schedules...');
        // Implementation for tax sale schedule monitoring
        return [];
    }
    async trackRedemptionPeriods(counties) {
        console.log('⏰ Tracking redemption periods...');
        // Implementation for redemption period tracking
        return [];
    }
    async fetchJSONTaxData(portal) {
        // Implementation for JSON API access
        return [];
    }
    async downloadCSVTaxData(page, portal) {
        // Implementation for CSV download
        return [];
    }
    async scrapeGenericTaxPortal(page, portal) {
        // Generic portal scraping implementation
        return [];
    }
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=taxDelinquencyIntelligence.js.map
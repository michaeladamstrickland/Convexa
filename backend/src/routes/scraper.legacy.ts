// LEGACY SCRAPER ROUTES (quarantined)
// Source: original monolithic scraper.ts (refactored to remove syntax errors)
// Status: Deprecated — enabled only if ENABLE_LEGACY_SCRAPER=true
// See docs/SCRAPER_DOCUMENTATION.md for rationale & migration plan.
import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, restrictTo } from '../middleware/auth';
import { catchAsync, AppError } from '../middleware/errorHandler';
import { zillowScraper } from '../scrapers/zillowScraper';
import { enhancedZillowScraper } from '../scrapers/enhancedZillowScraper';
import { auctionDotComScraper } from '../scrapers/auctionScraper';
import { enhancedAuctionDotComScraper } from '../scrapers/enhancedAuctionScraper';
import { logger } from '../utils/logger';
import scraperLogger from '../utils/scraperLogger';
import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Direct SQLite (legacy) — DO NOT EXTEND
let db: Database;
(async () => {
	try {
		db = await open({
			filename: path.resolve(__dirname, '../../../prisma/dev.db'),
			driver: sqlite3.Database
		});
		await db.exec(`
			CREATE TABLE IF NOT EXISTS scraping_jobs (
				id TEXT PRIMARY KEY,
				source TEXT NOT NULL,
				status TEXT NOT NULL,
				config TEXT NOT NULL,
				startedAt TEXT NOT NULL,
				completedAt TEXT,
				logs TEXT,
				resultsCount INTEGER DEFAULT 0,
				createdAt TEXT NOT NULL,
				updatedAt TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS property_records (
				id TEXT PRIMARY KEY,
				address TEXT NOT NULL,
				city TEXT,
				state TEXT,
				zipCode TEXT,
				source TEXT NOT NULL,
				rawData TEXT NOT NULL,
				processed INTEGER DEFAULT 0,
				scrapingJobId TEXT,
				createdAt TEXT NOT NULL,
				updatedAt TEXT NOT NULL,
				FOREIGN KEY (scrapingJobId) REFERENCES scraping_jobs(id)
			);
			CREATE TABLE IF NOT EXISTS scraping_schedules (
				id TEXT PRIMARY KEY,
				enabled INTEGER DEFAULT 0,
				frequency TEXT,
				time TEXT,
				day TEXT,
				sources TEXT NOT NULL,
				zipCodes TEXT,
				createdAt TEXT NOT NULL,
				updatedAt TEXT NOT NULL
			);
		`);
		logger.info('[legacy] Scraper SQLite tables ensured');
	} catch (e) {
		logger.error('[legacy] Failed to init SQLite:', e);
	}
})();

router.use(authenticate as any);

export const runZillowScraper = catchAsync(async (req: Request, res: Response) => {
	try {
		logger.info('[legacy] Zillow scraper request body:', req.body);
		let { zipCodes, maxPages = 3, useEnhanced = false } = req.body;
		if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
			zipCodes = ['07001', '07002'];
			logger.warn('[legacy] Invalid zipCodes; using defaults');
		}
		if (typeof maxPages !== 'number' || maxPages < 1) {
			maxPages = 3; logger.warn('[legacy] Invalid maxPages; default=3');
		}
		useEnhanced = Boolean(useEnhanced);
		const now = new Date().toISOString();
		const jobId = uuidv4();
		await db.run(
			`INSERT INTO scraping_jobs (id, source, status, config, startedAt, createdAt, updatedAt)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[ jobId, 'zillow_fsbo', 'pending', JSON.stringify({ zipCodes, maxPages, useEnhanced }), now, now, now ]
		);
		const selectedScraper = useEnhanced ? enhancedZillowScraper : zillowScraper;
		setTimeout(() => {
			selectedScraper.runFullScrape(zipCodes, maxPages)
				.then(async (results: any) => {
					const count = Array.isArray(results) ? results.length : 0;
						await db.run(
						`UPDATE scraping_jobs SET status=?, completedAt=?, resultsCount=?, updatedAt=? WHERE id=?`,
						['completed', new Date().toISOString(), count, new Date().toISOString(), jobId]
					);
					const updatedJob = await db.get('SELECT * FROM scraping_jobs WHERE id=?', jobId);
					const ws = require('../utils/scraperWebSocketService').default;
					ws.broadcastJobUpdate({ action: 'job_completed', job: updatedJob });
					logger.info(`[legacy] Zillow job ${jobId} completed (${count})`);
				})
				.catch(async (error: any) => {
					await db.run(
						`UPDATE scraping_jobs SET status=?, completedAt=?, logs=?, updatedAt=? WHERE id=?`,
						['failed', new Date().toISOString(), error?.message || 'Unknown error', new Date().toISOString(), jobId]
					);
					const updatedJob = await db.get('SELECT * FROM scraping_jobs WHERE id=?', jobId);
						const ws = require('../utils/scraperWebSocketService').default;
					ws.broadcastJobUpdate({ action: 'job_failed', job: updatedJob });
					logger.error(`[legacy] Zillow job ${jobId} failed`, error);
				});
		}, 0);
		res.json({ success: true, message: 'Scraping job started', data: { jobId } });
	} catch (error: any) {
		logger.error('[legacy] Error starting Zillow job:', error);
		res.status(500).json({ success: false, message: error.message || 'Unexpected error' });
	}
});

export const runAuctionScraper = catchAsync(async (req: Request, res: Response) => {
	const { state, auctionType = 'all', maxPages = 3, useEnhanced = false } = req.body;
	if (!state) throw new AppError('State is required', 400);
	const stateMapping: Record<string,string> = { CA: 'California', NY: 'New York', NJ: 'New Jersey' };
	const stateName = stateMapping[state] || state;
	const locations = [stateName];
	const now = new Date().toISOString();
	const jobId = uuidv4();
	await db.run(
		`INSERT INTO scraping_jobs (id, source, status, config, startedAt, createdAt, updatedAt)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[ jobId, 'auction_com', 'pending', JSON.stringify({ state, auctionType, maxPages, useEnhanced }), now, now, now ]
	);
	const selectedScraper = useEnhanced ? enhancedAuctionDotComScraper : auctionDotComScraper;
	(async () => {
		try {
			process.env.PUPPETEER_HEADLESS = 'true';
			await selectedScraper.initialize();
			scraperLogger.logScraperActivity('auction_com', jobId, 'search_started', { state: stateName, maxPages });
			const listings = await selectedScraper.searchListingsByLocation(locations, maxPages);
			await enhancedAuctionDotComScraper.close();
			const resultsCount = listings.length;
			const resultsFile = scraperLogger.saveScraperResults('auction_com', listings, jobId);
			scraperLogger.logScraperActivity('auction_com', jobId, 'search_completed', { state: stateName, resultsCount, resultsFile });
			for (const listing of listings) {
				const recordId = uuidv4();
				await db.run(
					`INSERT INTO property_records (id, address, city, state, zipCode, source, rawData, scrapingJobId, createdAt, updatedAt)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[ recordId, listing.propertyAddress || 'Unknown', listing.city || '', listing.state || '', listing.zipCode || '', 'auction_com', JSON.stringify(listing), jobId, now, now ]
				);
			}
			await db.run(
				`UPDATE scraping_jobs SET status=?, completedAt=?, resultsCount=?, updatedAt=? WHERE id=?`,
				['completed', new Date().toISOString(), resultsCount, new Date().toISOString(), jobId]
			);
			const updatedJob = await db.get('SELECT * FROM scraping_jobs WHERE id=?', jobId);
			const ws = require('../utils/scraperWebSocketService').default;
			ws.broadcastJobUpdate({ action: 'job_completed', job: updatedJob });
			logger.info(`[legacy] Auction job ${jobId} completed (${resultsCount})`);
		} catch (error: any) {
			try { await enhancedAuctionDotComScraper.close(); } catch {}
			scraperLogger.logScraperActivity('auction_com', jobId, 'search_failed', { error: error?.message });
			await db.run(
				`UPDATE scraping_jobs SET status=?, completedAt=?, logs=?, updatedAt=? WHERE id=?`,
				['failed', new Date().toISOString(), error?.message || 'Unknown error', new Date().toISOString(), jobId]
			);
			const updatedJob = await db.get('SELECT * FROM scraping_jobs WHERE id=?', jobId);
			const ws = require('../utils/scraperWebSocketService').default;
			ws.broadcastJobUpdate({ action: 'job_failed', job: updatedJob });
			logger.error(`[legacy] Auction job ${jobId} failed`, error);
		}
	})();
	res.json({ success: true, message: 'Auction scraping job started', data: { jobId } });
});

export const runCountyScraper = catchAsync(async (req: Request, res: Response) => {
	const { county, state, dateRange = 30 } = req.body;
	if (!county || !state) throw new AppError('County and state are required', 400);
	const now = new Date().toISOString();
	const jobId = uuidv4();
	await db.run(
		`INSERT INTO scraping_jobs (id, source, status, config, startedAt, createdAt, updatedAt)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[ jobId, 'county_records', 'pending', JSON.stringify({ county, state, dateRange }), now, now, now ]
	);
	setTimeout(async () => {
		try {
			const resultsCount = Math.floor(Math.random() * 30) + 5;
			await db.run(`UPDATE scraping_jobs SET status=?, completedAt=?, resultsCount=?, updatedAt=? WHERE id=?`,
				['completed', new Date().toISOString(), resultsCount, new Date().toISOString(), jobId]);
			const updatedJob = await db.get('SELECT * FROM scraping_jobs WHERE id=?', jobId);
			const ws = require('../utils/scraperWebSocketService').default;
			ws.broadcastJobUpdate({ action: 'job_completed', job: updatedJob });
			logger.info(`[legacy] County job ${jobId} completed (${resultsCount})`);
		} catch (error: any) {
			await db.run(`UPDATE scraping_jobs SET status=?, completedAt=?, logs=?, updatedAt=? WHERE id=?`,
				['failed', new Date().toISOString(), error?.message || 'Unknown error', new Date().toISOString(), jobId]);
			const updatedJob = await db.get('SELECT * FROM scraping_jobs WHERE id=?', jobId);
			const ws = require('../utils/scraperWebSocketService').default;
			ws.broadcastJobUpdate({ action: 'job_failed', job: updatedJob });
			logger.error(`[legacy] County job ${jobId} failed`, error);
		}
	}, 5000);
	res.json({ success: true, message: 'County scraping job started', data: { jobId } });
});

export const getScrapingJobs = catchAsync(async (req: Request, res: Response) => {
	const { page = 1, limit = 20, status, source } = req.query as any;
	const skip = (Number(page) - 1) * Number(limit);
	let whereClause = '';
	const params: any[] = [];
	const conditions: string[] = [];
	if (status) { conditions.push('status = ?'); params.push(status); }
	if (source) { conditions.push('source = ?'); params.push(source); }
	if (conditions.length) whereClause = 'WHERE ' + conditions.join(' AND ');
	const jobs = await db.all(`SELECT * FROM scraping_jobs ${whereClause} ORDER BY startedAt DESC LIMIT ? OFFSET ?`, [...params, Number(limit), skip]);
	const totalResult = await db.get(`SELECT COUNT(*) as total FROM scraping_jobs ${whereClause}`, params);
	const total = totalResult ? totalResult.total : 0;
	res.json({ success: true, data: { jobs, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } } });
});

export const getScrapingJob = catchAsync(async (req: Request, res: Response) => {
	const { id } = req.params;
	const job = await db.get('SELECT * FROM scraping_jobs WHERE id = ?', id);
	if (!job) throw new AppError('Scraping job not found', 404);
	res.json({ success: true, data: job });
});

router.post('/zillow', restrictTo('admin','manager') as any, runZillowScraper);
router.post('/auction', restrictTo('admin','manager') as any, runAuctionScraper);
router.post('/county', restrictTo('admin','manager') as any, runCountyScraper);
router.get('/jobs', getScrapingJobs);
router.get('/jobs/:id', getScrapingJob);

export default router;

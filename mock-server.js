/**
 * Mock Server for Testing
 * 
 * This file provides mock functionality for testing without running the actual server.
 * It's only used when the TEST_MODE=mock environment variable is set.
 */

import { logger } from './test-logger.js';

// Mock data
const mockSchedules = [
  {
    id: 'mock-schedule-1',
    name: 'Mock Zillow Schedule',
    scraperType: 'zillow_fsbo',
    cronExpression: '0 12 * * 1',
    config: {
      locations: ['07001', '90210'],
      maxPages: 1
    },
    isActive: true,
    lastRun: null,
    nextRun: '2025-09-11T12:00:00Z',
    createdAt: '2025-09-01T10:00:00Z',
    updatedAt: '2025-09-01T10:00:00Z'
  },
  {
    id: 'mock-schedule-2',
    name: 'Mock Auction Schedule',
    scraperType: 'auction_com',
    cronExpression: '0 14 * * 3',
    config: {
      locations: ['Las Vegas, NV', 'Miami, FL'],
      maxPages: 1
    },
    isActive: true,
    lastRun: '2025-09-04T14:00:00Z',
    nextRun: '2025-09-11T14:00:00Z',
    createdAt: '2025-09-01T11:00:00Z',
    updatedAt: '2025-09-01T11:00:00Z'
  }
];

// Mock job scheduler
export const mockJobScheduler = {
  initialize: async () => {
    logger.info('Initializing mock job scheduler');
    return true;
  },
  
  getSchedules: async (includeInactive = false) => {
    logger.info(`Getting schedules (includeInactive=${includeInactive})`);
    return mockSchedules;
  },
  
  getScheduleById: async (id) => {
    logger.info(`Getting schedule by ID: ${id}`);
    return mockSchedules.find(s => s.id === id) || null;
  },
  
  createSchedule: async (scheduleData) => {
    logger.info(`Creating schedule: ${JSON.stringify(scheduleData)}`);
    const newSchedule = {
      id: `mock-${Date.now()}`,
      ...scheduleData,
      isActive: true,
      lastRun: null,
      nextRun: '2025-09-15T12:00:00Z',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return newSchedule;
  },
  
  updateSchedule: async (id, data) => {
    logger.info(`Updating schedule ${id}: ${JSON.stringify(data)}`);
    const schedule = mockSchedules.find(s => s.id === id);
    if (!schedule) return null;
    
    return {
      ...schedule,
      ...data,
      updatedAt: new Date().toISOString()
    };
  },
  
  deleteSchedule: async (id) => {
    logger.info(`Deleting schedule: ${id}`);
    return true;
  },
  
  runScheduleNow: async (id) => {
    logger.info(`Running schedule immediately: ${id}`);
    return `mock-job-${Date.now()}`;
  },
  
  stop: () => {
    logger.info('Stopping mock job scheduler');
  }
};

// Mock scrapers
export const mockZillowScraper = {
  initialize: async () => {
    logger.info('Initializing mock Zillow scraper');
    return true;
  },
  
  scrapeFSBOListings: async (locations, maxPages = 1) => {
    logger.info(`Scraping Zillow FSBO listings for locations: ${locations.join(', ')}`);
    return [
      {
        address: '123 Main St',
        city: 'Beverly Hills',
        state: 'CA',
        zipCode: '90210',
        price: 1250000,
        bedrooms: 4,
        bathrooms: 3,
        squareFootage: 2500,
        propertyType: 'Single Family',
        listingUrl: 'https://www.zillow.com/homedetails/123-main-st',
        zillowId: 'mock-zillow-1'
      },
      {
        address: '456 Oak Ave',
        city: 'Avenel',
        state: 'NJ',
        zipCode: '07001',
        price: 450000,
        bedrooms: 3,
        bathrooms: 2,
        squareFootage: 1800,
        propertyType: 'Single Family',
        listingUrl: 'https://www.zillow.com/homedetails/456-oak-ave',
        zillowId: 'mock-zillow-2'
      }
    ];
  },
  
  getListingDetails: async (url) => {
    logger.info(`Getting details for Zillow listing: ${url}`);
    return {
      description: 'Beautiful home in excellent neighborhood',
      images: ['image1.jpg', 'image2.jpg'],
      priceHistory: [
        { date: '2025-01-01', price: 1300000 },
        { date: '2025-06-01', price: 1250000 }
      ],
      yearBuilt: 1995,
      lotSize: 0.25
    };
  },
  
  close: async () => {
    logger.info('Closing mock Zillow scraper');
    return true;
  }
};

export const mockAuctionDotComScraper = {
  initialize: async () => {
    logger.info('Initializing mock Auction.com scraper');
    return true;
  },
  
  searchListingsByLocation: async (locations, maxPages = 1) => {
    logger.info(`Searching Auction.com listings for locations: ${locations.join(', ')}`);
    return [
      {
        propertyAddress: '789 Pine Ln',
        city: 'Las Vegas',
        state: 'NV',
        zipCode: '89101',
        auctionType: 'Live Auction',
        startingBid: 200000,
        auctionStartDate: '2025-10-15T10:00:00Z',
        propertyType: 'Single Family',
        bedrooms: 3,
        bathrooms: 2,
        squareFootage: 1600,
        listingUrl: 'https://www.auction.com/details/789-pine-ln'
      },
      {
        propertyAddress: '101 Beach Dr',
        city: 'Miami',
        state: 'FL',
        zipCode: '33139',
        auctionType: 'Online Auction',
        startingBid: 350000,
        auctionStartDate: '2025-10-20T14:00:00Z',
        propertyType: 'Condo',
        bedrooms: 2,
        bathrooms: 2,
        squareFootage: 1200,
        listingUrl: 'https://www.auction.com/details/101-beach-dr'
      }
    ];
  },
  
  getListingDetails: async (url) => {
    logger.info(`Getting details for Auction.com listing: ${url}`);
    return {
      propertyDetails: 'Bank owned property in prime location',
      images: ['auction1.jpg', 'auction2.jpg'],
      foreclosureStatus: 'REO',
      yearBuilt: 2005,
      lotSize: 0.15
    };
  },
  
  close: async () => {
    logger.info('Closing mock Auction.com scraper');
    return true;
  }
};

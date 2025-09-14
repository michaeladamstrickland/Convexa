import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import axios from 'axios';
import { AttomClient } from '../src/services/attomClient';
import { BatchSkipTraceService } from '../src/services/batchSkipTraceService';
import { normalizeAddress } from '../src/utils/addressNormalization';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        lead: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn()
        }
      };
    })
  };
});

describe('Address Normalization', () => {
  it('should normalize addresses correctly', () => {
    // Test basic normalization
    expect(normalizeAddress('123 Main Street, New York, NY 10001')).toBe('123 main st new york ny 10001');
    
    // Test with abbreviations
    expect(normalizeAddress('123 N. Main St., Apt 4B, New York, NY 10001')).toBe('123 n main st new york ny 10001');
    
    // Test with different formats
    expect(normalizeAddress('123 MAIN STREET NORTH, NEW YORK, NY 10001')).toBe('123 main st n new york ny 10001');
  });
});

describe('ATTOM Client', () => {
  let attomClient: AttomClient;
  
  beforeEach(() => {
    process.env.ATTOM_API_KEY = 'test-api-key';
    
    // Reset mocks
    mockedAxios.create.mockReturnValue({
      get: (jest.fn() as any).mockResolvedValue({ data: {} })
    } as any);
    
    attomClient = new AttomClient();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  it('should be instantiated with API key', () => {
    expect(attomClient).toBeDefined();
    expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: expect.any(String),
      headers: expect.objectContaining({
        apiKey: 'test-api-key'
      })
    }));
  });
  
  it('should handle errors when API key is missing', () => {
    delete process.env.ATTOM_API_KEY;
    expect(() => new AttomClient()).toThrow('ATTOM API key not found');
  });
  
  // Add more tests for specific methods as needed
});

describe('BatchData Skip Trace Service', () => {
  let batchService: BatchSkipTraceService;
  
  beforeEach(() => {
    process.env.BATCHDATA_API_KEY = 'test-api-key';
    
    // Reset mocks
    mockedAxios.create.mockReturnValue({
      post: (jest.fn() as any).mockResolvedValue({ data: {} }),
      get: (jest.fn() as any).mockResolvedValue({ data: {} })
    } as any);
    
    batchService = new BatchSkipTraceService();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  it('should be instantiated with API key', () => {
    expect(batchService).toBeDefined();
    expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: expect.any(String),
      headers: expect.objectContaining({
        'X-API-Key': 'test-api-key'
      })
    }));
  });
  
  it('should handle errors when API key is missing', () => {
    delete process.env.BATCHDATA_API_KEY;
    expect(() => new BatchSkipTraceService()).toThrow('BatchData API key not found');
  });
  
  // Add more tests for specific methods as needed
});

// Additional tests can be added for the unified search controller and other components

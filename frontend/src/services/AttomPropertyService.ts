import axios from 'axios';

// API base URL - Using the integrated server
// NOTE: Server might not be running, so we'll add error handling
const API_BASE_URL = 'http://localhost:5001';

// Mock data for development when API is not available
const MOCK_ENABLED = false;  // Set to false in production

export interface PropertySearchFilters {
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
  propertyType?: string;
  yearBuiltAfter?: string;
  yearBuiltBefore?: string;
  squareFeetMin?: string;
  squareFeetMax?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  radius?: string;
  latitude?: number;
  longitude?: number;
  polygon?: Array<{lat: number; lng: number}>;
}

export interface PropertyResult {
  attomId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  propertyType: string;
  yearBuilt?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  lotSize?: number;
  lotSizeUnit?: string;
  stories?: number;
  garage?: string;
  pool?: boolean;
  fireplaces?: number;
  
  // Owner information (enriched)
  ownerName?: string;
  ownerOccupied?: boolean;
  ownerType?: string;
  ownerMailingAddress?: string;
  ownerMailingCity?: string;
  ownerMailingState?: string;
  ownerMailingZip?: string;
  deedType?: string;
  deedDate?: string;
  
  // Financial information (enriched)
  lastSaleDate?: string;
  lastSalePrice?: number;
  estimatedValue?: number;
  estimatedValueRange?: {
    low: number;
    high: number;
  };
  confidenceScore?: number;
  taxAssessedValue?: number;
  taxMarketValue?: number;
  taxYear?: number;
  estimatedEquity?: number;
  
  // Additional metadata
  parcelId?: string;
  fips?: string;
  apn?: string;
  legal1?: string;
  subdivision?: string;
  zoning?: string;
  
  // Tax and mortgage
  taxRate?: number;
  taxAmount?: number;
  mortgageAmount?: number;
  mortgageLender?: string;
  mortgageDate?: string;
  mortgageMaturityDate?: string;
  mortgageInterestRate?: number;
}

export interface PropertySearchResponse {
  status: string;
  message: string;
  total?: number;
  page?: number;
  pageSize?: number;
  properties: PropertyResult[];
}

export class AttomPropertyService {
  // Mock property data for when API is not available
  private static getMockProperties(zipCode?: string): PropertyResult[] {
    return [
      {
        attomId: "100001",
        address: "123 Main St",
        city: zipCode ? "Denver" : "Beverly Hills",
        state: zipCode ? "CO" : "CA", 
        zipCode: zipCode || "90210",
        latitude: 39.7392,
        longitude: -104.9903,
        propertyType: "SingleFamily",
        yearBuilt: 1985,
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1800,
        lotSize: 6000,
        lotSizeUnit: "sqft",
        lastSaleDate: "2022-05-15",
        lastSalePrice: 450000,
        ownerName: "John Smith",
        ownerOccupied: true,
        estimatedValue: 495000
      },
      {
        attomId: "100002",
        address: "456 Oak Avenue",
        city: zipCode ? "Denver" : "Beverly Hills",
        state: zipCode ? "CO" : "CA",
        zipCode: zipCode || "90210",
        latitude: 39.7291,
        longitude: -104.9864,
        propertyType: "Condo",
        yearBuilt: 2005,
        bedrooms: 2,
        bathrooms: 2,
        squareFeet: 1200,
        lotSize: 0,
        lotSizeUnit: "sqft",
        lastSaleDate: "2023-01-10",
        lastSalePrice: 380000,
        ownerName: "Jane Doe",
        ownerOccupied: false,
        estimatedValue: 410000
      },
      {
        attomId: "100003",
        address: "789 Pine Street",
        city: zipCode ? "Denver" : "Beverly Hills",
        state: zipCode ? "CO" : "CA",
        zipCode: zipCode || "90210",
        latitude: 39.7352,
        longitude: -104.9781,
        propertyType: "MultiFamily",
        yearBuilt: 1972,
        bedrooms: 4,
        bathrooms: 3,
        squareFeet: 2400,
        lotSize: 8500,
        lotSizeUnit: "sqft",
        lastSaleDate: "2021-08-22",
        lastSalePrice: 625000,
        ownerName: "Robert Johnson",
        ownerOccupied: true,
        estimatedValue: 680000
      },
      {
        attomId: "100004",
        address: "101 Maple Drive",
        city: zipCode ? "Denver" : "Beverly Hills",
        state: zipCode ? "CO" : "CA",
        zipCode: zipCode || "90210",
        latitude: 39.7401,
        longitude: -104.9923,
        propertyType: "TownHouse",
        yearBuilt: 1998,
        bedrooms: 3,
        bathrooms: 2.5,
        squareFeet: 1750,
        lotSize: 2200,
        lotSizeUnit: "sqft",
        lastSaleDate: "2023-04-05",
        lastSalePrice: 520000,
        ownerName: "Emily Wilson",
        ownerOccupied: true,
        estimatedValue: 545000
      },
      {
        attomId: "100005",
        address: "555 Cedar Court",
        city: zipCode ? "Denver" : "Beverly Hills",
        state: zipCode ? "CO" : "CA",
        zipCode: zipCode || "90210",
        latitude: 39.7312,
        longitude: -104.9801,
        propertyType: "SingleFamily",
        yearBuilt: 2010,
        bedrooms: 5,
        bathrooms: 3.5,
        squareFeet: 3200,
        lotSize: 9500,
        lotSizeUnit: "sqft",
        lastSaleDate: "2022-11-15",
        lastSalePrice: 875000,
        ownerName: "Michael Brown",
        ownerOccupied: true,
        estimatedValue: 920000
      }
    ];
  }

  // Search properties by applying filters
  static async searchProperties(filters: PropertySearchFilters): Promise<PropertySearchResponse> {
    try {
      console.log('🔍 Searching properties with filters:', filters);
      
      let endpoint: string;
      let params: Record<string, any> = {};
      
      // Determine the appropriate search endpoint based on filters
      if (filters.zipCode) {
        endpoint = '/api/attom/property/zip';
        params = {
          zip: filters.zipCode,
          page: 1,
          pageSize: 20
        };
      } else if (filters.latitude && filters.longitude) {
        endpoint = '/api/attom/property/location';
        params = {
          latitude: filters.latitude,
          longitude: filters.longitude,
          radius: filters.radius || 1, // miles
          page: 1,
          pageSize: 20
        };
      } else if (filters.polygon && filters.polygon.length > 2) {
        endpoint = '/api/attom/property/polygon';
        params = {
          polygon: JSON.stringify(filters.polygon),
          page: 1,
          pageSize: 20
        };
      } else {
        // Default to basic search
        endpoint = '/api/attom/property/search';
        params = {
          page: 1,
          pageSize: 20
        };
      }
      
      // Add property filters
      if (filters.minPrice) params.minValue = filters.minPrice;
      if (filters.maxPrice) params.maxValue = filters.maxPrice;
      if (filters.bedrooms) params.minBeds = filters.bedrooms;
      if (filters.bathrooms) params.minBaths = filters.bathrooms;
      if (filters.propertyType) params.propertyType = filters.propertyType;
      if (filters.yearBuiltAfter) params.yearBuiltAfter = filters.yearBuiltAfter;
      if (filters.yearBuiltBefore) params.yearBuiltBefore = filters.yearBuiltBefore;
      if (filters.squareFeetMin) params.squareFeetMin = filters.squareFeetMin;
      if (filters.squareFeetMax) params.squareFeetMax = filters.squareFeetMax;
      if (filters.city) params.city = filters.city;
      if (filters.state) params.state = filters.state;
      
      try {
        const response = await axios.get(`${API_BASE_URL}${endpoint}`, { params, timeout: 3000 });
        
        return {
          status: response.data.status,
          message: response.data.message,
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.pageSize,
          properties: response.data.properties || []
        };
      } catch (apiError) {
        if (!MOCK_ENABLED) {
          console.error('API server not available and mock data is disabled');
          throw new Error('API server connection failed. Please make sure the ATTOM API server is running.');
        }
        
        console.warn('API server not available, using mock data');
        
        // Use mock data when API is not available
        const mockProperties = this.getMockProperties(filters.zipCode);
        
        // Filter mock properties
        let filteredProperties = [...mockProperties];
        
        if (filters.minPrice) {
          filteredProperties = filteredProperties.filter(p => 
            p.estimatedValue && p.estimatedValue >= parseInt(filters.minPrice || '0')
          );
        }
        
        if (filters.maxPrice) {
          filteredProperties = filteredProperties.filter(p => 
            p.estimatedValue && p.estimatedValue <= parseInt(filters.maxPrice || '9999999999')
          );
        }
        
        if (filters.bedrooms) {
          filteredProperties = filteredProperties.filter(p => 
            p.bedrooms && p.bedrooms >= parseInt(filters.bedrooms || '0')
          );
        }
        
        if (filters.bathrooms) {
          filteredProperties = filteredProperties.filter(p => 
            p.bathrooms && p.bathrooms >= parseFloat(filters.bathrooms || '0')
          );
        }
        
        // Return mock response
        return {
          status: 'success',
          message: `Found ${filteredProperties.length} properties (mock data)`,
          total: filteredProperties.length,
          page: 1,
          pageSize: 20,
          properties: filteredProperties
        };
      }
    } catch (error: any) {
      console.error('Error searching properties:', error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to search properties'
      );
    }
  }
  
  // Get property details by ATTOM ID - enriched with detailed data
  static async getPropertyDetails(attomId: string): Promise<PropertyResult> {
    try {
      console.log(`Getting enriched property details for ATTOM ID: ${attomId}`);
      
      try {
        // Fetch detailed property data from multiple endpoints in parallel
        const [detailResponse, ownerResponse, valuationResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/attom/property/${attomId}/detail`, { timeout: 3000 }),
          axios.get(`${API_BASE_URL}/api/attom/property/${attomId}/owner`, { timeout: 3000 }),
          axios.get(`${API_BASE_URL}/api/attom/property/${attomId}/valuation`, { timeout: 3000 })
        ]);
        
        // Check if any of the responses failed
        if (detailResponse.data.status !== 'success') {
          throw new Error(detailResponse.data.message || 'Failed to get property details');
        }
        
        // Get the base property data
        const property = detailResponse.data.property;
        
        // Merge owner data if available
        if (ownerResponse.data.status === 'success' && ownerResponse.data.owner) {
          const ownerData = ownerResponse.data.owner;
          property.ownerName = ownerData.name || property.ownerName;
          property.ownerMailingAddress = ownerData.mailingAddress;
          property.ownerMailingCity = ownerData.mailingCity;
          property.ownerMailingState = ownerData.mailingState;
          property.ownerMailingZip = ownerData.mailingZip;
          property.ownerOccupied = ownerData.ownerOccupied || property.ownerOccupied;
          property.ownerType = ownerData.ownerType; // Individual, LLC, Trust, etc.
          property.deedType = ownerData.deedType;
          property.deedDate = ownerData.deedDate;
        }
        
        // Merge valuation data if available
        if (valuationResponse.data.status === 'success' && valuationResponse.data.valuation) {
          const valuationData = valuationResponse.data.valuation;
          property.estimatedValue = valuationData.estimatedValue || property.estimatedValue;
          property.estimatedValueRange = {
            low: valuationData.estimatedValueLow,
            high: valuationData.estimatedValueHigh
          };
          property.confidenceScore = valuationData.confidenceScore;
          property.lastSalePrice = valuationData.lastSalePrice || property.lastSalePrice;
          property.lastSaleDate = valuationData.lastSaleDate || property.lastSaleDate;
          property.taxAssessedValue = valuationData.taxAssessedValue;
          property.taxMarketValue = valuationData.taxMarketValue;
          property.taxYear = valuationData.taxYear;
          property.estimatedEquity = valuationData.estimatedEquity;
        }
        
        console.log('Enriched property data:', property);
        return property;
      } catch (apiError) {
        if (!MOCK_ENABLED) {
          console.error('API server not available and mock data is disabled');
          throw new Error('API server connection failed. Please make sure the ATTOM API server is running.');
        }
        
        console.warn('API server not available, using mock data for property details');
        
        // Find property in mock data or create a new one with this ID
        const mockProperties = this.getMockProperties();
        const property = mockProperties.find(p => p.attomId === attomId) || {
          attomId,
          address: `${Math.floor(Math.random() * 1000)} Sample Street`,
          city: "Denver",
          state: "CO",
          zipCode: "80202",
          latitude: 39.7392 + (Math.random() * 0.01),
          longitude: -104.9903 + (Math.random() * 0.01),
          propertyType: "SingleFamily",
          yearBuilt: 1980 + Math.floor(Math.random() * 40),
          bedrooms: 2 + Math.floor(Math.random() * 4),
          bathrooms: 1 + Math.floor(Math.random() * 3),
          squareFeet: 1000 + Math.floor(Math.random() * 2000),
          lotSize: 5000 + Math.floor(Math.random() * 5000),
          lotSizeUnit: "sqft",
          lastSaleDate: new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          lastSalePrice: 300000 + Math.floor(Math.random() * 500000),
          ownerName: "Sample Owner",
          ownerOccupied: Math.random() > 0.5,
          estimatedValue: 350000 + Math.floor(Math.random() * 600000),
        };
        
        // Add additional details
        const enhancedProperty: PropertyResult = {
          ...property,
          ownerType: Math.random() > 0.7 ? 'LLC' : 'Individual',
          ownerMailingAddress: Math.random() > 0.2 ? property.address : '789 Different St',
          ownerMailingCity: property.city,
          ownerMailingState: property.state,
          ownerMailingZip: property.zipCode,
          deedType: 'Warranty Deed',
          deedDate: new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          taxAssessedValue: Math.round((property.estimatedValue || 400000) * 0.85),
          taxMarketValue: Math.round((property.estimatedValue || 400000) * 0.9),
          taxYear: new Date().getFullYear() - 1,
          estimatedValueRange: {
            low: Math.round((property.estimatedValue || 400000) * 0.9),
            high: Math.round((property.estimatedValue || 400000) * 1.1)
          },
          confidenceScore: 70 + Math.floor(Math.random() * 25),
          estimatedEquity: Math.round((property.estimatedValue || 400000) - (property.lastSalePrice || 300000))
        };
        
        return enhancedProperty;
      }
    } catch (error: any) {
      console.error(`Error getting enriched property details for ID ${attomId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to get enriched property details'
      );
    }
  }
  
  // Get property valuation by ATTOM ID
  static async getPropertyValuation(attomId: string): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attom/property/${attomId}/valuation`);
      
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to get property valuation');
      }
      
      return response.data.valuation;
    } catch (error: any) {
      console.error(`Error getting property valuation for ID ${attomId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to get property valuation'
      );
    }
  }
  
  // Get property owner information by ATTOM ID
  static async getPropertyOwner(attomId: string): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attom/property/${attomId}/owner`);
      
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to get property owner information');
      }
      
      return response.data.owner;
    } catch (error: any) {
      console.error(`Error getting property owner for ID ${attomId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to get property owner information'
      );
    }
  }
  
  // Get property tax history by ATTOM ID
  static async getPropertyTaxHistory(attomId: string): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attom/property/${attomId}/taxhistory`);
      
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to get property tax history');
      }
      
      return response.data.taxHistory;
    } catch (error: any) {
      console.error(`Error getting tax history for ID ${attomId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to get property tax history'
      );
    }
  }
  
  // Get property sales history by ATTOM ID
  static async getPropertySalesHistory(attomId: string): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attom/property/${attomId}/saleshistory`);
      
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to get property sales history');
      }
      
      return response.data.salesHistory;
    } catch (error: any) {
      console.error(`Error getting sales history for ID ${attomId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to get property sales history'
      );
    }
  }
  
  // Add property as a lead with full enriched data
  static async addPropertyAsLead(attomId: string): Promise<any> {
    try {
      console.log(`Adding property as lead with enriched data for ATTOM ID: ${attomId}`);
      
      try {
        // Call the new lead enrichment endpoint
        const response = await axios.post(`${API_BASE_URL}/api/attom/lead/enrich`, { attomId }, { timeout: 5000 });
        
        if (response.data.status !== 'success') {
          throw new Error(response.data.message || 'Failed to add property as lead');
        }
        
        console.log('Property successfully added as lead with enriched data:', response.data.lead);
        return response.data.lead;
      } catch (apiError: any) {
        if (!MOCK_ENABLED) {
          console.error('API server not available and mock data is disabled');
          throw new Error('API server connection failed. Please make sure the ATTOM API server is running.');
        }
        
        console.warn('API server not available, using mock data for lead enrichment');
        
        // Use getPropertyDetails to get mock data
        const property = await this.getPropertyDetails(attomId);
        
        // Return mock enriched lead
        return {
          ...property,
          leadQualityScore: Math.floor(Math.random() * 40) + 60, // 60-100
          createdAt: new Date().toISOString(),
          enrichmentLevel: 'full',
          dataSource: 'ATTOM (Mock)'
        };
      }
    } catch (error: any) {
      console.error(`Error adding property as lead for ID ${attomId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to add property as lead'
      );
    }
  }
  
  // Export properties to CSV format
  static exportToCSV(properties: PropertyResult[]): string {
    // Headers
    const headers = [
      'ATTOM ID',
      'Address',
      'City',
      'State',
      'ZIP Code',
      'Property Type',
      'Year Built',
      'Bedrooms',
      'Bathrooms',
      'Square Feet',
      'Lot Size',
      'Last Sale Date',
      'Last Sale Price',
      'Owner Name',
      'Owner Occupied',
      'Estimated Value'
    ].join(',');
    
    // Rows
    const rows = properties.map(property => [
      property.attomId,
      `"${property.address}"`,
      `"${property.city}"`,
      property.state,
      property.zipCode,
      `"${property.propertyType || ''}"`,
      property.yearBuilt || '',
      property.bedrooms || '',
      property.bathrooms || '',
      property.squareFeet || '',
      property.lotSize ? `${property.lotSize} ${property.lotSizeUnit || ''}` : '',
      property.lastSaleDate || '',
      property.lastSalePrice || '',
      `"${property.ownerName || ''}"`,
      property.ownerOccupied ? 'Yes' : 'No',
      property.estimatedValue || ''
    ].join(','));
    
    // Combine headers and rows
    return [headers, ...rows].join('\n');
  }
  
  // Utility to download CSV data as a file
  static downloadCSV(data: string, filename: string): void {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', filename || 'property_search_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export default AttomPropertyService;

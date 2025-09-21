import api from '../api/client';

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
  radius?: number; // miles
  latitude?: number | null;
  longitude?: number | null;
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
  // Search properties by applying filters
  static async searchProperties(filters: PropertySearchFilters): Promise<PropertySearchResponse> {
    try {
      console.log('🔍 Searching properties with filters:', filters);
      
      let endpoint: string;
      let params: Record<string, any> = {};
      
      // Determine the appropriate search endpoint based on filters
      if (filters.zipCode) {
  endpoint = '/attom/property/zip';
        params = {
          zip: filters.zipCode,
          page: 1,
          pageSize: 20
        };
      } else if (filters.latitude && filters.longitude) {
  endpoint = '/attom/property/location';
        params = {
          latitude: filters.latitude,
          longitude: filters.longitude,
          radius: filters.radius || 1, // miles
          page: 1,
          pageSize: 20
        };
      } else if (filters.polygon && filters.polygon.length > 2) {
  endpoint = '/attom/property/polygon';
        params = {
          polygon: JSON.stringify(filters.polygon),
          page: 1,
          pageSize: 20
        };
      } else {
        // Default to basic search
  endpoint = '/attom/property/search';
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
      
      const response = await api.get(endpoint, { params, timeout: 3000 });
      return {
        status: response.data.status,
        message: response.data.message,
        total: response.data.total,
        page: response.data.page,
        pageSize: response.data.pageSize,
        properties: response.data.properties || []
      };
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
      // Fetch detailed property data from multiple endpoints in parallel
      const [detailResponse, ownerResponse, valuationResponse] = await Promise.all([
        api.get(`/attom/property/${attomId}/detail`, { timeout: 3000 }),
        api.get(`/attom/property/${attomId}/owner`, { timeout: 3000 }),
        api.get(`/attom/property/${attomId}/valuation`, { timeout: 3000 })
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
      const response = await api.get(`/attom/property/${attomId}/valuation`);
      
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
      const response = await api.get(`/attom/property/${attomId}/owner`);
      
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
      const response = await api.get(`/attom/property/${attomId}/taxhistory`);
      
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
      const response = await api.get(`/attom/property/${attomId}/saleshistory`);
      
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
      // Call the lead enrichment endpoint
      const response = await api.post(`/attom/lead/enrich`, { attomId }, { timeout: 5000 });
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to add property as lead');
      }
      console.log('Property successfully added as lead with enriched data:', response.data.lead);
      return response.data.lead;
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

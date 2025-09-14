import axios from 'axios';
import dotenv from 'dotenv';
import { Comparable } from '../../shared/types/deal';

dotenv.config();

// ATTOM API configuration
const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_API_HOST = 'api.gateway.attomdata.com';
const ATTOM_API_BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

// Default headers for ATTOM API requests
const defaultHeaders = {
  'Accept': 'application/json',
  'apikey': ATTOM_API_KEY,
  'Accept-Encoding': 'gzip'
};

// Interface for ATTOM property data response
interface AttomProperty {
  address?: {
    oneLine?: string;
    locality?: string;
    countrySubd?: string;
    postal1?: string;
  };
  identifier?: {
    Id?: string;
    apnOrig?: string;
  };
  building?: {
    size?: {
      universalsize?: number;
    };
    rooms?: {
      beds?: number;
      bathsTotal?: number;
    };
  };
  lot?: {
    lotSize1?: number;
  };
  summary?: {
    yearBuilt?: number;
  };
  avm?: {
    amount?: {
      value?: number;
    };
  };
}

// Interface for comp filter options
interface CompFilterOptions {
  radius: number;       // in miles
  monthsBack: number;   // number of months to look back for sales
  bedsDelta: number;    // +/- number of beds
  bathsDelta: number;   // +/- number of baths
  sqftDeltaPct: number; // as a decimal (e.g., 0.25 for 25%)
  excludeIds?: string[];// IDs to exclude from results
}

// Function to geocode an address using ATTOM
async function geocodeAddress(address: string): Promise<{lat: number, lon: number} | null> {
  try {
    const response = await axios({
      method: 'get',
      url: `${ATTOM_API_BASE_URL}/property/basicprofile`,
      headers: defaultHeaders,
      params: {
        address: address
      }
    });
    
    const property = response.data?.property?.[0];
    
    if (property?.location?.latitude && property?.location?.longitude) {
      return {
        lat: property.location.latitude,
        lon: property.location.longitude
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error geocoding address with ATTOM:', error);
    return null;
  }
}

// Function to fetch property data from ATTOM
export async function fetchAttomPropertyData(address: string): Promise<AttomProperty | null> {
  try {
    // If API key not configured, return null
    if (!ATTOM_API_KEY) {
      console.warn('ATTOM API key not configured');
      return null;
    }
    
    const response = await axios({
      method: 'get',
      url: `${ATTOM_API_BASE_URL}/property/expandedprofile`,
      headers: defaultHeaders,
      params: {
        address: address
      }
    });
    
    return response.data?.property?.[0] || null;
  } catch (error) {
    console.error('Error fetching property data from ATTOM:', error);
    return null;
  }
}

// Function to fetch comparable properties from ATTOM
export async function fetchAttomComps(
  address: {line: string; city: string; state: string; zip: string}, 
  options: CompFilterOptions
): Promise<AttomProperty[]> {
  try {
    // If API key not configured, return empty array
    if (!ATTOM_API_KEY) {
      console.warn('ATTOM API key not configured');
      return [];
    }
    
    // First geocode the address
    let coordinates;
    const addressString = `${address.line}, ${address.city}, ${address.state} ${address.zip}`;
    
    coordinates = await geocodeAddress(addressString);
    
    if (!coordinates) {
      console.error('Could not geocode address:', addressString);
      return [];
    }
    
    // Calculate date range for sales
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - options.monthsBack);
    
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];
    
    // Get basic property data to determine baseline beds/baths/sqft
    const baseProperty = await fetchAttomPropertyData(addressString);
    
    if (!baseProperty) {
      console.error('Could not fetch base property data for comps');
      return [];
    }
    
    const baseBeds = baseProperty.building?.rooms?.beds || 3;
    const baseBaths = baseProperty.building?.rooms?.bathsTotal || 2;
    const baseSqft = baseProperty.building?.size?.universalsize || 1500;
    
    // Calculate min/max values for filters
    const minBeds = Math.max(1, baseBeds - options.bedsDelta);
    const maxBeds = baseBeds + options.bedsDelta;
    const minBaths = Math.max(1, baseBaths - options.bathsDelta);
    const maxBaths = baseBaths + options.bathsDelta;
    const minSqft = baseSqft * (1 - options.sqftDeltaPct);
    const maxSqft = baseSqft * (1 + options.sqftDeltaPct);
    
    // Fetch sales comps
    const response = await axios({
      method: 'get',
      url: `${ATTOM_API_BASE_URL}/sale/snapshot`,
      headers: defaultHeaders,
      params: {
        latitude: coordinates.lat,
        longitude: coordinates.lon,
        radius: options.radius,
        startdatetime: formattedStartDate,
        enddatetime: formattedEndDate,
        minBeds,
        maxBeds,
        minBathsTotl: minBaths,
        maxBathsTotl: maxBaths,
        minUniversalSizeActual: minSqft,
        maxUniversalSizeActual: maxSqft
      }
    });
    
    let comps = response.data?.property || [];
    
    // Filter out excluded IDs
    if (options.excludeIds && options.excludeIds.length > 0) {
      comps = comps.filter((comp: any) => 
        !options.excludeIds?.includes(comp.identifier?.Id)
      );
    }
    
    return comps;
  } catch (error) {
    console.error('Error fetching comps from ATTOM:', error);
    return [];
  }
}

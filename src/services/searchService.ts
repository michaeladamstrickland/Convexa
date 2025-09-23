import { PrismaClient, Prisma } from '@prisma/client';
import NodeCache from 'node-cache';
import { convexaCacheHitTotal, convexaCacheTotal } from '../server';

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize cache with TTL of 5 minutes
const cache = new NodeCache({ stdTTL: 300 });

// Type for search parameters
export interface SearchParams {
  query?: string;
  minValue?: number;
  maxValue?: number;
  city?: string;
  state?: string;
  zipCode?: string;
  propertyType?: string;
  source?: string;
  temperature?: string;
  status?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Search service class
export class SearchService {
  /**
   * Search for leads with various filters
   */
  async searchLeads(params: SearchParams) {
    const {
      query,
      minValue,
      maxValue,
      city,
      state,
      zipCode,
      propertyType,
      source,
      temperature,
      status,
      limit = 50,
      page = 1,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = params;

    // Create cache key from params
    const cacheKey = JSON.stringify(params);
    
    // Check cache first
    convexaCacheTotal.inc({ operation: 'get', cache_name: 'search_leads' });
    const cachedResults = cache.get(cacheKey);
    if (cachedResults) {
      convexaCacheHitTotal.inc({ operation: 'get', cache_name: 'search_leads' });
      return cachedResults;
    }

    // Build query filters
    const where: Prisma.LeadWhereInput = {};
    
    // Text search
    if (query) {
      where.OR = [
        { address: { contains: query } },
        { owner_name: { contains: query } }
      ];
    }
    
    // Location filters
    if (city) {
      where.address = { contains: city };
    }
    
    if (state) {
      where.address = { contains: state };
    }
    
    if (zipCode) {
      where.address = { contains: zipCode };
    }
    
    // Value range
    if (minValue !== undefined) {
      where.estimated_value = { gte: minValue };
    }
    
    if (maxValue !== undefined) {
      where.estimated_value = { lte: maxValue };
    }
    
    // Property type/source filters
    if (propertyType) {
      where.source_type = propertyType;
    }
    
    if (source) {
      where.source = source;
    }
    
    // Temperature and status filters
    if (temperature) {
      where.temperature_tag = temperature;
    }
    
    if (status) {
      where.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Determine sort order
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    try {
      // Get total count
      const totalCount = await prisma.lead.count({ where });
      
      // Get results
      const leads = await prisma.lead.findMany({
        where,
        take: limit,
        skip,
        orderBy,
      });
      
      // Format results
      const formattedLeads = leads.map(lead => this.formatLead(lead));
      
      // Create pagination info
      const pagination = {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      };
      
      const results = {
        leads: formattedLeads,
        pagination
      };
      
      // Cache the results
      convexaCacheTotal.inc({ operation: 'set', cache_name: 'search_leads' });
      cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Error in searchLeads:', error);
      throw error;
    }
  }

  /**
   * Get lead analytics and metrics
   */
  async getLeadAnalytics() {
    const cacheKey = 'lead_analytics';
    
    // Check cache
    convexaCacheTotal.inc({ operation: 'get', cache_name: 'lead_analytics' });
    const cachedAnalytics = cache.get(cacheKey);
    if (cachedAnalytics) {
      convexaCacheHitTotal.inc({ operation: 'get', cache_name: 'lead_analytics' });
      return cachedAnalytics;
    }
    
    try {
      // Get total count
      const totalCount = await prisma.lead.count();
      
      // Get total estimated value
      const totalValueResult = await prisma.lead.aggregate({
        _sum: {
          estimated_value: true
        }
      });
      
      // Get average motivation score
      const avgMotivationResult = await prisma.lead.aggregate({
        _avg: {
          motivation_score: true
        }
      });
      
      // Get counts by temperature
      const temperatureCounts = await prisma.$queryRaw`
        SELECT temperature_tag as tag, COUNT(*) as count 
        FROM Lead 
        GROUP BY temperature_tag
      `;
      
      // Get counts by source
      const sourceCounts = await prisma.$queryRaw`
        SELECT source as source, COUNT(*) as count 
        FROM Lead 
        GROUP BY source
      `;
      
      // Get counts by status
      const statusCounts = await prisma.$queryRaw`
        SELECT status as status, COUNT(*) as count 
        FROM Lead 
        GROUP BY status
      `;
      
      const analytics = {
        totalLeads: totalCount,
        totalEstimatedValue: totalValueResult._sum.estimated_value || 0,
        avgMotivationScore: avgMotivationResult._avg.motivation_score || 0,
        temperatureDistribution: temperatureCounts,
        leadsBySource: sourceCounts,
        leadsByStatus: statusCounts,
        potentialRevenue: (totalValueResult._sum.estimated_value || 0) * 0.05 // 5% of total value
      };
      
      // Cache the results
      convexaCacheTotal.inc({ operation: 'set', cache_name: 'lead_analytics' });
      cache.set(cacheKey, analytics);
      
      return analytics;
    } catch (error) {
      console.error('Error in getLeadAnalytics:', error);
      throw error;
    }
  }

  /**
   * Clear search cache
   */
  clearCache() {
    cache.flushAll();
    return { success: true, message: 'Cache cleared successfully' };
  }

  /**
   * Format lead for API response
   */
  private formatLead(lead: any) {
    // Parse JSON string fields if needed
    let phones: string[] = [];
    let emails: string[] = [];
    let rawData: any = {};
    
    try {
      if (lead.phones) phones = JSON.parse(lead.phones);
      if (lead.emails) emails = JSON.parse(lead.emails);
      if (lead.raw_data) rawData = JSON.parse(lead.raw_data);
    } catch (err) {
      console.error('Error parsing JSON fields:', err);
    }
    
    return {
      id: lead.id,
      propertyAddress: lead.address,
      ownerName: lead.owner_name,
      phone: lead.phone,
      phones,
      email: lead.email,
      emails,
      estimatedValue: lead.estimated_value,
      equity: lead.equity,
      motivationScore: lead.motivation_score,
      aiScore: lead.aiScore || 0,
      temperatureTag: lead.temperature_tag,
      status: lead.status,
      source: lead.source,
      sourceType: lead.source_type,
      isProbate: Boolean(lead.is_probate),
      isVacant: Boolean(lead.is_vacant),
      conditionScore: lead.condition_score,
      leadScore: lead.lead_score,
      notes: lead.notes,
      rawData,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at
    };
  }
}

export default new SearchService();

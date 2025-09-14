import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Interface for API cost entry
interface ApiCost {
  apiType: string;
  cost: number;
  details?: string;
}

// Log an API cost entry
export async function logApiCost(costData: ApiCost): Promise<void> {
  try {
    await prisma.apiCostEntry.create({
      data: {
        apiType: costData.apiType,
        cost: costData.cost,
        details: costData.details
      }
    });
  } catch (error) {
    console.error('Error logging API cost:', error);
  }
}

// Get total API costs for a period
export async function getApiCosts(options: {
  apiType?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalCost: number;
  costByType: Record<string, number>;
  entries: any[];
}> {
  try {
    const { apiType, startDate, endDate } = options;
    
    // Build where clause
    const where: any = {};
    
    if (apiType) {
      where.apiType = apiType;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }
    
    // Get entries
    const entries = await prisma.apiCostEntry.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Calculate costs
    const totalCost = entries.reduce((sum, entry) => sum + entry.cost, 0);
    
    // Group by API type
    const costByType: Record<string, number> = {};
    entries.forEach(entry => {
      costByType[entry.apiType] = (costByType[entry.apiType] || 0) + entry.cost;
    });
    
    return {
      totalCost,
      costByType,
      entries
    };
  } catch (error) {
    console.error('Error getting API costs:', error);
    return {
      totalCost: 0,
      costByType: {},
      entries: []
    };
  }
}

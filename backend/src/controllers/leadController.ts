import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { catchAsync, AppError } from '../middleware/errorHandler';
import { aiService } from '../services/aiService';
import { skipTraceService } from '../services/skipTraceService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const getLeads = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, status, source, priority, search } = req.query;
  const organizationId = req.user!.organizationId;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build filter conditions
  const where: any = {
    organizationId,
    isActive: true,
  };

  if (status) where.status = status;
  if (source) where.source = source;
  if (priority) where.priority = priority;
  
  if (search) {
    where.OR = [
      { propertyAddress: { contains: search as string, mode: 'insensitive' } },
      { ownerName: { contains: search as string, mode: 'insensitive' } },
      { city: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: Number(limit),
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        _count: {
          select: {
            callLogs: true,
            leadNotes: true,
            skipTraceRecords: true,
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    }),
    prisma.lead.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

export const getLead = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const organizationId = req.user!.organizationId;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId },
    include: {
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      callLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          createdBy: {
            select: { firstName: true, lastName: true }
          }
        }
      },
      leadNotes: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      skipTraceRecords: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      campaignLogs: {
        orderBy: { sentAt: 'desc' },
        take: 10,
        include: {
          campaign: {
            select: { name: true, type: true }
          }
        }
      }
    },
  });

  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  res.json({
    success: true,
    data: lead,
  });
});

export const createLead = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user!.organizationId;
  
  const leadData = {
    ...req.body,
    organizationId,
    assignedToId: req.body.assignedToId || req.user!.id,
  };

  const lead = await prisma.lead.create({
    data: leadData,
    include: {
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
    },
  });

  // Run AI analysis in background
  if (lead.listPrice || lead.arv) {
    aiService.analyzeLeadPotential({
      propertyAddress: lead.propertyAddress,
      listPrice: lead.listPrice || undefined,
      arv: lead.arv || undefined,
      estimatedRepairs: lead.estimatedRepairs || undefined,
      equity: lead.equity || undefined,
      equityPercent: lead.equityPercent || undefined,
      timeOnMarket: lead.timeOnMarket || undefined,
      priceReductions: lead.priceReductions || undefined,
      ownerName: lead.ownerName || undefined,
      isAbsenteeOwner: lead.isAbsenteeOwner,
      propertyType: lead.propertyType || undefined,
      yearBuilt: lead.yearBuilt || undefined,
      bedrooms: lead.bedrooms || undefined,
      bathrooms: lead.bathrooms || undefined,
      squareFootage: lead.squareFootage || undefined,
      tags: typeof lead.tags === 'string' ? [lead.tags] : (lead.tags || []),
    }).then(async (analysis) => {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          aiScore: analysis.dealScore,
          motivationScore: analysis.motivationScore,
          motivationFactors: JSON.stringify(analysis.motivationFactors),
          distressSignals: JSON.stringify(analysis.distressSignals),
          aiSummary: analysis.summary,
          dealPotential: analysis.dealPotential,
          profitEstimate: analysis.profitEstimate,
        },
      });
      logger.info(`AI analysis completed for lead ${lead.id}`);
    }).catch(error => {
      logger.error(`AI analysis failed for lead ${lead.id}:`, error);
    });
  }

  res.status(201).json({
    success: true,
    data: lead,
  });
});

export const updateLead = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const organizationId = req.user!.organizationId;

  // Check if lead exists and belongs to organization
  const existingLead = await prisma.lead.findFirst({
    where: { id, organizationId },
  });

  if (!existingLead) {
    throw new AppError('Lead not found', 404);
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: req.body,
    include: {
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
    },
  });

  res.json({
    success: true,
    data: lead,
  });
});

export const deleteLead = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const organizationId = req.user!.organizationId;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId },
  });

  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  // Soft delete by setting isActive to false
  await prisma.lead.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({
    success: true,
    message: 'Lead deleted successfully',
  });
});

export const runSkipTrace = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const organizationId = req.user!.organizationId;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId },
  });

  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  // Check if skip trace already exists and is recent
  const recentSkipTrace = await prisma.skipTraceRecord.findFirst({
    where: {
      leadId: id,
      status: 'completed',
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentSkipTrace) {
    return res.json({
      success: true,
      message: 'Recent skip trace found',
      data: JSON.parse(recentSkipTrace.responseData || '{}'),
    });
  }

  // Parse owner name
  const nameParts = (lead.ownerName || '').split(' ');
  const skipTraceRequest = {
    firstName: nameParts[0],
    lastName: nameParts[nameParts.length - 1],
    fullName: lead.ownerName || undefined,
    address: lead.propertyAddress,
    city: lead.city,
    state: lead.state,
    zipCode: lead.zipCode,
    phone: lead.ownerPhone || undefined,
    email: lead.ownerEmail || undefined,
  };

  const result = await skipTraceService.runSkipTrace(id, skipTraceRequest);

  if (result.success && result.data) {
    // Update lead with skip trace data
    const updateData: any = {};
    
    if (result.data.phones && result.data.phones.length > 0) {
      updateData.ownerPhone = result.data.phones[0].number;
    }
    
    if (result.data.emails && result.data.emails.length > 0) {
      updateData.ownerEmail = result.data.emails[0].address;
    }

    if (result.data.fullName) {
      updateData.ownerName = result.data.fullName;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.lead.update({
        where: { id },
        data: updateData,
      });
    }
  }

  res.json({
    success: true,
    data: result,
  });
});

export const addLeadNote = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { content, type = 'general' } = req.body;
  const organizationId = req.user!.organizationId;

  // Verify lead belongs to organization
  const lead = await prisma.lead.findFirst({
    where: { id, organizationId },
  });

  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  const note = await prisma.leadNote.create({
    data: {
      leadId: id,
      content,
      type,
    },
  });

  res.status(201).json({
    success: true,
    data: note,
  });
});

export const getLeadStats = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user!.organizationId;
  const { timeframe = '30d' } = req.query;

  // Calculate date range
  const daysAgo = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
  const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    newLeads,
    statusCounts,
    sourceCounts,
    priorityCounts,
    avgAIScore,
    avgMotivationScore,
  ] = await Promise.all([
    prisma.lead.count({
      where: { organizationId, isActive: true },
    }),
    prisma.lead.count({
      where: {
        organizationId,
        isActive: true,
        createdAt: { gte: startDate },
      },
    }),
    prisma.lead.groupBy({
      by: ['status'],
      where: { organizationId, isActive: true },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ['source'],
      where: { organizationId, isActive: true },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ['priority'],
      where: { organizationId, isActive: true },
      _count: true,
    }),
    prisma.lead.aggregate({
      where: {
        organizationId,
        isActive: true,
        aiScore: { not: null },
      },
      _avg: { aiScore: true },
    }),
    prisma.lead.aggregate({
      where: {
        organizationId,
        isActive: true,
        motivationScore: { not: null },
      },
      _avg: { motivationScore: true },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalLeads,
      newLeads,
      statusDistribution: statusCounts,
      sourceDistribution: sourceCounts,
      priorityDistribution: priorityCounts,
      averageAIScore: avgAIScore._avg.aiScore || 0,
      averageMotivationScore: avgMotivationScore._avg.motivationScore || 0,
    },
  });
});

export const generateCallScript = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const organizationId = req.user!.organizationId;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId },
  });

  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  const script = await aiService.generateCallScript({
    ownerName: lead.ownerName || undefined,
    propertyAddress: lead.propertyAddress,
    motivationFactors: lead.motivationFactors ? JSON.parse(lead.motivationFactors) : undefined,
    propertyType: lead.propertyType || undefined,
    timeOnMarket: lead.timeOnMarket || undefined,
  });

  res.json({
    success: true,
    data: { script },
  });
});

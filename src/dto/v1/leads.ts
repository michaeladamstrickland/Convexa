import { z } from 'zod';

export const Pagination = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  pages: z.number().int().nonnegative(),
});

export const Lead = z.object({
  id: z.string(),
  propertyAddress: z.string().min(1),
  ownerName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  estimatedValue: z.number().nullable().optional(),
  equity: z.number().nullable().optional(),
  motivationScore: z.number().int().min(0).max(100).optional(),
  temperatureTag: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  isProbate: z.boolean().optional(),
  isVacant: z.boolean().optional(),
  conditionScore: z.number().int().min(0).max(100).optional(),
  leadScore: z.number().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const LeadListResponse = z.object({
  leads: z.array(Lead),
  pagination: Pagination,
});

export const LeadCreate = z.object({
  address: z.string().min(1),
  owner_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  estimated_value: z.number().optional(),
  equity: z.number().optional(),
  motivation_score: z.number().int().min(0).max(100).optional(),
  temperature_tag: z.string().optional(),
  source_type: z.string().optional(),
  is_probate: z.boolean().optional(),
  is_vacant: z.boolean().optional(),
  condition_score: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  attom_id: z.string().optional(),
});

export type LeadT = z.infer<typeof Lead>;
export type LeadListResponseT = z.infer<typeof LeadListResponse>;
export type LeadCreateT = z.infer<typeof LeadCreate>;

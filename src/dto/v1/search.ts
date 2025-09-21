import { z } from 'zod';

export const SearchQuery = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  propertyType: z.string().optional(),
  source: z.string().optional(),
  temperature: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type SearchQueryT = z.infer<typeof SearchQuery>;

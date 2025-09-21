import { z } from 'zod';

export const SkiptraceRequest = z.object({
  force: z.boolean().optional(),
  provider: z.string().optional(),
  fallback: z.boolean().optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  runId: z.string().uuid().optional(),
});

export const SkiptraceResult = z.object({
  leadId: z.string(),
  phones: z.array(z.any()),
  emails: z.array(z.any()),
  cached: z.boolean().optional(),
  cost: z.number().nullable().optional(),
  provider: z.string().nullable().optional(),
});

export type SkiptraceRequestT = z.infer<typeof SkiptraceRequest>;
export type SkiptraceResultT = z.infer<typeof SkiptraceResult>;

import { z } from 'zod';

export const DialRequest = z.object({
  leadId: z.string(),
  toNumber: z.string().min(10), // Expect E164 but allow len check for now
  fromNumber: z.string().min(10),
  record: z.boolean().default(true),
  metadata: z.record(z.string()).optional(),
});

export const DialResponse = z.object({
  dialId: z.string(),
  status: z.enum(["queued", "in_progress", "failed"]),
  provider: z.enum(["twilio"]).default("twilio"),
  createdAt: z.string(),
});

export const RecordingWebhook = z.object({
  CallSid: z.string(),
  RecordingUrl: z.string(),
  RecordingDuration: z.string().optional(),
});

export const AsrComplete = z.object({
  dialId: z.string(),
  transcriptUrl: z.string().url(),
  words: z.number().int().nonnegative().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
});

export type DialRequestT = z.infer<typeof DialRequest>;
export type DialResponseT = z.infer<typeof DialResponse>;
export type RecordingWebhookT = z.infer<typeof RecordingWebhook>;
export type AsrCompleteT = z.infer<typeof AsrComplete>;

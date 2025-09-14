// Simple in-memory metrics collectors for enrichment pipeline
export const enrichmentMetrics = {
  processed: 0,
  durations: [] as number[],
};

export function recordEnrichment(durationMs: number) {
  enrichmentMetrics.processed++;
  enrichmentMetrics.durations.push(durationMs);
}

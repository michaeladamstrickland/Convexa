// Simple in-memory metrics collectors for enrichment pipeline
export const enrichmentMetrics = {
    processed: 0,
    durations: [],
};
export function recordEnrichment(durationMs) {
    enrichmentMetrics.processed++;
    enrichmentMetrics.durations.push(durationMs);
}
//# sourceMappingURL=enrichment.js.map
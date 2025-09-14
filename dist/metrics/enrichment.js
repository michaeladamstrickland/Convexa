"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichmentMetrics = void 0;
exports.recordEnrichment = recordEnrichment;
// Simple in-memory metrics collectors for enrichment pipeline
exports.enrichmentMetrics = {
    processed: 0,
    durations: [],
};
function recordEnrichment(durationMs) {
    exports.enrichmentMetrics.processed++;
    exports.enrichmentMetrics.durations.push(durationMs);
}
//# sourceMappingURL=enrichment.js.map
import { enqueueEnrichmentJob } from '../queues/enrichmentQueue';
export async function enqueuePropertyEnrichment(propertyId) {
    return enqueueEnrichmentJob({ propertyId });
}
//# sourceMappingURL=enqueueEnrichmentJob.js.map
import { enqueueEnrichmentJob } from '../queues/enrichmentQueue';

export async function enqueuePropertyEnrichment(propertyId: string) {
  return enqueueEnrichmentJob({ propertyId });
}

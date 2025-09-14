"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueuePropertyEnrichment = enqueuePropertyEnrichment;
const enrichmentQueue_1 = require("../queues/enrichmentQueue");
async function enqueuePropertyEnrichment(propertyId) {
    return (0, enrichmentQueue_1.enqueueEnrichmentJob)({ propertyId });
}
//# sourceMappingURL=enqueueEnrichmentJob.js.map
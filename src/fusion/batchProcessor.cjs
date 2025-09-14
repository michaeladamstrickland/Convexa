/**
 * batchProcessor.cjs
 * Utilities for batch processing property data
 */

const { fuseProperties } = require('./propertyFusion.cjs');
const { batchEnhanceWithAttom } = require('./attomFusion.cjs');

/**
 * Process a batch of property records
 * @param {Array} properties - Array of property records
 * @param {Object} options - Processing options
 * @param {Object} options.attomData - Optional ATTOM data keyed by addressHash
 * @param {boolean} options.deduplicate - Whether to deduplicate properties
 * @param {boolean} options.enhanceWithAttom - Whether to enhance with ATTOM data
 * @returns {Array} Processed property records
 */
async function processBatch(properties, options = {}) {
  if (!properties || !properties.length) {
    return [];
  }
  
  const {
    attomData = null,
    deduplicate = true,
    enhanceWithAttom = Boolean(attomData)
  } = options;
  
  let result = [...properties];
  
  // Enhance with ATTOM data if available
  if (enhanceWithAttom && attomData) {
    result = batchEnhanceWithAttom(attomData, result);
  }
  
  // Deduplicate properties
  if (deduplicate) {
    result = deduplicateProperties(result);
  }
  
  return result;
}

/**
 * Deduplicate properties by addressHash
 * @param {Array} properties - Array of property records
 * @returns {Array} Deduplicated property records
 */
function deduplicateProperties(properties) {
  if (!properties || !properties.length) {
    return [];
  }
  
  // Group properties by addressHash
  const groupedByAddress = properties.reduce((acc, property) => {
    if (!property.addressHash) return acc;
    
    if (!acc[property.addressHash]) {
      acc[property.addressHash] = [];
    }
    
    acc[property.addressHash].push(property);
    return acc;
  }, {});
  
  // Fuse each group of properties
  return Object.values(groupedByAddress).map(group => {
    if (group.length === 1) return group[0];
    return fuseProperties(null, group);
  });
}

/**
 * Stream process properties in chunks
 * @param {AsyncGenerator} propertyGenerator - Async generator yielding properties
 * @param {Object} options - Processing options
 * @param {number} options.chunkSize - Size of each processing chunk
 * @param {Function} options.onChunkComplete - Callback for each processed chunk
 * @returns {Array} All processed properties
 */
async function streamProcess(propertyGenerator, options = {}) {
  const {
    chunkSize = 100,
    onChunkComplete = null,
    ...processingOptions
  } = options;
  
  const allResults = [];
  let currentChunk = [];
  
  // Process properties in chunks
  for await (const property of propertyGenerator) {
    currentChunk.push(property);
    
    // Process chunk when it reaches target size
    if (currentChunk.length >= chunkSize) {
      const processedChunk = await processBatch(currentChunk, processingOptions);
      
      allResults.push(...processedChunk);
      
      if (onChunkComplete) {
        await onChunkComplete(processedChunk);
      }
      
      // Reset chunk
      currentChunk = [];
    }
  }
  
  // Process final chunk if it has any items
  if (currentChunk.length > 0) {
    const processedChunk = await processBatch(currentChunk, processingOptions);
    
    allResults.push(...processedChunk);
    
    if (onChunkComplete) {
      await onChunkComplete(processedChunk);
    }
  }
  
  return allResults;
}

module.exports = {
  processBatch,
  deduplicateProperties,
  streamProcess
};

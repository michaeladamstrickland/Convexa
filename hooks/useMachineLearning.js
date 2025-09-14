// useMachineLearning.js
// Custom React hook for interacting with machine learning services

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * Custom hook to interact with machine learning services
 * @param {Object} options - Configuration options
 * @returns {Object} ML utility functions and state
 */
const useMachineLearning = (options = {}) => {
  // Default configuration
  const config = {
    baseUrl: '/api',
    pollingInterval: 5000,
    enablePolling: false,
    enableCache: true,
    cacheTTL: 15 * 60 * 1000, // 15 minutes
    ...options
  };

  // State variables
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mlStatus, setMlStatus] = useState({
    available: false,
    modelsLoaded: false,
    activeModels: []
  });
  const [predictionCache] = useState(new Map());
  const [predictionQueue, setPredictionQueue] = useState([]);
  const [queueProcessing, setQueueProcessing] = useState(false);
  
  /**
   * Check ML service status
   */
  const checkStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${config.baseUrl}/ml/status`);
      setMlStatus(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to check ML status:', error);
      setMlStatus({
        available: false,
        error: error.message
      });
      return { available: false };
    }
  }, [config.baseUrl]);

  /**
   * Process a property to get predictions
   * @param {Object} property - Property data
   * @returns {Promise<Object>} Property with predictions
   */
  const processProperty = useCallback(async (property) => {
    if (!property || !property.id) {
      throw new Error('Invalid property: missing property ID');
    }

    setLoading(true);
    setError(null);

    try {
      // Check cache first if enabled
      if (config.enableCache) {
        const cacheKey = `property_${property.id}`;
        const cached = predictionCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp < config.cacheTTL)) {
          setLoading(false);
          return cached.data;
        }
      }

      // Make API request
      const response = await axios.post(
        `${config.baseUrl}/ml/process-property`,
        { property }
      );

      // Cache the result if enabled
      if (config.enableCache) {
        const cacheKey = `property_${property.id}`;
        predictionCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
      }

      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to process property');
      throw err;
    }
  }, [config.baseUrl, config.enableCache, config.cacheTTL, predictionCache]);

  /**
   * Queue a property for processing
   * @param {Object} property - Property data
   * @returns {string} Queue ID
   */
  const queueProperty = useCallback((property) => {
    if (!property || !property.id) {
      throw new Error('Invalid property: missing property ID');
    }

    const queueId = `queue_${Date.now()}_${property.id}`;
    
    setPredictionQueue(queue => [
      ...queue,
      {
        id: queueId,
        property,
        timestamp: Date.now(),
        status: 'pending'
      }
    ]);

    // Start processing queue if not already processing
    if (!queueProcessing) {
      processQueue();
    }

    return queueId;
  }, [queueProcessing]);

  /**
   * Process the prediction queue
   */
  const processQueue = useCallback(async () => {
    if (predictionQueue.length === 0) {
      setQueueProcessing(false);
      return;
    }

    setQueueProcessing(true);

    // Get the next item from the queue
    const nextItem = predictionQueue[0];
    
    // Update item status to processing
    setPredictionQueue(queue => queue.map(item => 
      item.id === nextItem.id 
        ? { ...item, status: 'processing' } 
        : item
    ));

    try {
      // Process the property
      await processProperty(nextItem.property);

      // Update item status to complete
      setPredictionQueue(queue => queue.map(item => 
        item.id === nextItem.id 
          ? { ...item, status: 'complete' } 
          : item
      ));
    } catch (error) {
      // Update item status to error
      setPredictionQueue(queue => queue.map(item => 
        item.id === nextItem.id 
          ? { ...item, status: 'error', error: error.message } 
          : item
      ));
    }

    // Remove the processed item from the queue
    setPredictionQueue(queue => queue.filter(item => item.id !== nextItem.id));

    // Continue processing the queue
    setTimeout(processQueue, 100);
  }, [predictionQueue, processProperty]);

  /**
   * Get lead score for a property
   * @param {Object} property - Property data
   * @returns {Promise<Object>} Lead score
   */
  const getLeadScore = useCallback(async (property) => {
    if (!property) {
      throw new Error('Invalid property data');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.baseUrl}/ml/lead-score`,
        { property }
      );

      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to get lead score');
      throw err;
    }
  }, [config.baseUrl]);

  /**
   * Generate contact strategy for a property
   * @param {Object} property - Property data
   * @returns {Promise<Object>} Contact strategy
   */
  const generateContactStrategy = useCallback(async (property) => {
    if (!property || !property.id) {
      throw new Error('Invalid property: missing property ID');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.baseUrl}/ml/contact-strategy`,
        { property }
      );

      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to generate contact strategy');
      throw err;
    }
  }, [config.baseUrl]);

  /**
   * Submit feedback about prediction accuracy
   * @param {Object} feedbackData - Feedback data
   * @returns {Promise<boolean>} Success status
   */
  const submitFeedback = useCallback(async (feedbackData) => {
    if (!feedbackData || !feedbackData.propertyId) {
      throw new Error('Invalid feedback data: missing property ID');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.baseUrl}/ml/feedback`,
        feedbackData
      );

      // Invalidate cache for this property
      if (config.enableCache) {
        const cacheKey = `property_${feedbackData.propertyId}`;
        predictionCache.delete(cacheKey);
      }

      setLoading(false);
      return response.data.success;
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to submit feedback');
      throw err;
    }
  }, [config.baseUrl, config.enableCache, predictionCache]);

  /**
   * Process a batch of properties
   * @param {Array<Object>} properties - Array of property data
   * @returns {Promise<Array<Object>>} Processed properties
   */
  const processBatch = useCallback(async (properties) => {
    if (!Array.isArray(properties) || properties.length === 0) {
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.baseUrl}/ml/process-batch`,
        { properties }
      );

      // Cache the results if enabled
      if (config.enableCache) {
        response.data.forEach(property => {
          if (property && property.id) {
            const cacheKey = `property_${property.id}`;
            predictionCache.set(cacheKey, {
              data: property,
              timestamp: Date.now()
            });
          }
        });
      }

      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to process property batch');
      throw err;
    }
  }, [config.baseUrl, config.enableCache, predictionCache]);

  /**
   * Get property value estimate
   * @param {Object} property - Property data
   * @returns {Promise<Object>} Value estimate
   */
  const getValueEstimate = useCallback(async (property) => {
    if (!property) {
      throw new Error('Invalid property data');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.baseUrl}/ml/value-estimate`,
        { property }
      );

      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to get value estimate');
      throw err;
    }
  }, [config.baseUrl]);

  /**
   * Check for distress signals in a property
   * @param {Object} property - Property data
   * @returns {Promise<Object>} Distress signals
   */
  const checkDistressSignals = useCallback(async (property) => {
    if (!property) {
      throw new Error('Invalid property data');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.baseUrl}/ml/distress-signals`,
        { property }
      );

      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to check distress signals');
      throw err;
    }
  }, [config.baseUrl]);

  /**
   * Clear prediction cache
   */
  const clearCache = useCallback(() => {
    predictionCache.clear();
  }, [predictionCache]);

  /**
   * Refresh property predictions
   * @param {Object} property - Property data
   * @param {boolean} force - Force refresh even if cached
   * @returns {Promise<Object>} Updated property
   */
  const refreshPredictions = useCallback(async (property, force = true) => {
    if (!property || !property.id) {
      throw new Error('Invalid property: missing property ID');
    }

    // Clear cache for this property if force refresh
    if (force && config.enableCache) {
      const cacheKey = `property_${property.id}`;
      predictionCache.delete(cacheKey);
    }

    return processProperty(property);
  }, [config.enableCache, predictionCache, processProperty]);

  // Initial status check and polling setup
  useEffect(() => {
    // Check status on mount
    checkStatus();
    
    // Set up polling if enabled
    let intervalId;
    if (config.enablePolling) {
      intervalId = setInterval(checkStatus, config.pollingInterval);
    }
    
    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [checkStatus, config.enablePolling, config.pollingInterval]);

  return {
    // State
    loading,
    error,
    mlStatus,
    predictionQueue,
    
    // Functions
    checkStatus,
    processProperty,
    queueProperty,
    getLeadScore,
    generateContactStrategy,
    submitFeedback,
    processBatch,
    getValueEstimate,
    checkDistressSignals,
    clearCache,
    refreshPredictions
  };
};

export default useMachineLearning;

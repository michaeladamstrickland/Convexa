/**
 * ATTOM Batch Processor Service
 * 
 * This service handles batch processing of ATTOM property data,
 * manages the upload and download of batch files, and integrates
 * the results into our unified property model.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { processPropertiesBulk, convertPropertiesToLeads } from './propertyIntegrationService.js';
import { configService } from './configService.js';
import db from './databaseService.js';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const ATTOM_API_KEY = configService.get('ATTOM_API_KEY');
const ATTOM_BATCH_API_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/batch';
const BATCH_UPLOAD_DIR = path.join(process.cwd(), 'data', 'attom_batch', 'uploads');
const BATCH_RESULTS_DIR = path.join(process.cwd(), 'data', 'attom_batch', 'results');

/**
 * Create a batch request from property addresses
 * 
 * @param {Array<Object>} properties - Array of property objects with address info
 * @param {string} batchName - Optional name for the batch
 * @returns {Object} Batch metadata including file path and batch ID
 */
export async function createBatchRequest(properties, batchName = '') {
  try {
    // Create batch upload directory if it doesn't exist
    if (!fs.existsSync(BATCH_UPLOAD_DIR)) {
      fs.mkdirSync(BATCH_UPLOAD_DIR, { recursive: true });
    }
    
    // Generate batch ID and name
    const batchId = uuidv4();
    const finalBatchName = batchName || `attom_batch_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const fileName = `${finalBatchName}.csv`;
    const filePath = path.join(BATCH_UPLOAD_DIR, fileName);
    
    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'address', title: 'Address' },
        { id: 'city', title: 'City' },
        { id: 'state', title: 'State' },
        { id: 'zip', title: 'Zip' }
      ]
    });
    
    // Format properties for CSV
    const data = properties.map(property => ({
      address: property.address || property.line1,
      city: property.city,
      state: property.state,
      zip: property.zipCode || property.zip
    }));
    
    // Write to CSV file
    await csvWriter.writeRecords(data);
    
    // Store batch metadata in database
    const batchMeta = {
      id: batchId,
      name: finalBatchName,
      fileName,
      filePath,
      status: 'created',
      recordCount: properties.length,
      createdAt: new Date().toISOString(),
      externalBatchId: null
    };
    
    await storeBatchMetadata(batchMeta);
    
    console.log(`Created batch request ${finalBatchName} with ${properties.length} records`);
    return batchMeta;
  } catch (error) {
    console.error('Error creating batch request:', error);
    throw error;
  }
}

/**
 * Submit a batch request to ATTOM API
 * 
 * @param {string} batchId - Batch ID to submit
 * @returns {Object} Response from ATTOM API
 */
export async function submitBatchRequest(batchId) {
  try {
    // Get batch metadata
    const batchMeta = await getBatchMetadata(batchId);
    if (!batchMeta) {
      throw new Error(`Batch ${batchId} not found`);
    }
    
    if (!fs.existsSync(batchMeta.filePath)) {
      throw new Error(`Batch file ${batchMeta.filePath} not found`);
    }
    
    // Create form data with CSV file
    const form = new FormData();
    form.append('addressBatchFile', fs.createReadStream(batchMeta.filePath));
    form.append('reportFormat', 'CSV'); // Specify CSV format
    
    // Submit to ATTOM API
    const response = await axios.post(ATTOM_BATCH_API_URL, form, {
      headers: {
        ...form.getHeaders(),
        'apikey': ATTOM_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    // Update batch metadata with ATTOM batch ID
    if (response.data && response.data.status && response.data.status.code === 0) {
      const attomBatchId = response.data.jobID || response.data.job_id;
      
      await updateBatchMetadata(batchId, {
        externalBatchId: attomBatchId,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        estimatedCompletionTime: response.data.estimatedTime,
        response: JSON.stringify(response.data)
      });
      
      console.log(`Successfully submitted batch ${batchId} to ATTOM API, job ID: ${attomBatchId}`);
      return {
        success: true,
        batchId,
        attomBatchId,
        estimatedTime: response.data.estimatedTime
      };
    } else {
      // Handle API error
      const errorMessage = response.data?.status?.msg || 'Unknown error';
      await updateBatchMetadata(batchId, {
        status: 'failed',
        error: errorMessage,
        response: JSON.stringify(response.data)
      });
      
      console.error(`Failed to submit batch ${batchId}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        response: response.data
      };
    }
  } catch (error) {
    console.error(`Error submitting batch ${batchId}:`, error);
    await updateBatchMetadata(batchId, {
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}

/**
 * Check the status of a batch request
 * 
 * @param {string} batchId - Internal batch ID
 * @returns {Object} Status information
 */
export async function checkBatchStatus(batchId) {
  try {
    // Get batch metadata
    const batchMeta = await getBatchMetadata(batchId);
    if (!batchMeta) {
      throw new Error(`Batch ${batchId} not found`);
    }
    
    if (!batchMeta.externalBatchId) {
      throw new Error(`Batch ${batchId} has not been submitted to ATTOM API`);
    }
    
    // Check status with ATTOM API
    const response = await axios.get(`${ATTOM_BATCH_API_URL}/status/${batchMeta.externalBatchId}`, {
      headers: {
        'apikey': ATTOM_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (response.data && response.data.status) {
      const attomStatus = response.data.status.toLowerCase();
      let internalStatus = attomStatus;
      
      // Map ATTOM statuses to our internal statuses
      if (attomStatus === 'completed') {
        internalStatus = 'ready_for_download';
      } else if (attomStatus === 'failed') {
        internalStatus = 'failed';
      }
      
      // Update batch metadata
      await updateBatchMetadata(batchId, {
        status: internalStatus,
        attomStatus,
        lastChecked: new Date().toISOString(),
        progressPercent: response.data.progress || 0,
        statusResponse: JSON.stringify(response.data)
      });
      
      console.log(`Batch ${batchId} status: ${attomStatus} (${response.data.progress || 0}%)`);
      return {
        success: true,
        status: attomStatus,
        progress: response.data.progress || 0,
        completedRecords: response.data.completedRecords || 0,
        totalRecords: response.data.totalRecords || batchMeta.recordCount
      };
    } else {
      console.error(`Failed to check status for batch ${batchId}`);
      return {
        success: false,
        error: 'Invalid response from ATTOM API',
        response: response.data
      };
    }
  } catch (error) {
    console.error(`Error checking status for batch ${batchId}:`, error);
    throw error;
  }
}

/**
 * Download batch results from ATTOM API
 * 
 * @param {string} batchId - Internal batch ID
 * @returns {Object} Download information
 */
export async function downloadBatchResults(batchId) {
  try {
    // Get batch metadata
    const batchMeta = await getBatchMetadata(batchId);
    if (!batchMeta) {
      throw new Error(`Batch ${batchId} not found`);
    }
    
    if (!batchMeta.externalBatchId) {
      throw new Error(`Batch ${batchId} has not been submitted to ATTOM API`);
    }
    
    // Create results directory if it doesn't exist
    if (!fs.existsSync(BATCH_RESULTS_DIR)) {
      fs.mkdirSync(BATCH_RESULTS_DIR, { recursive: true });
    }
    
    // Download results from ATTOM API
    const response = await axios.get(`${ATTOM_BATCH_API_URL}/result/${batchMeta.externalBatchId}`, {
      headers: {
        'apikey': ATTOM_API_KEY,
        'Accept': 'application/octet-stream'
      },
      responseType: 'stream'
    });
    
    // Save results to file
    const fileName = `${batchMeta.name}_results.csv`;
    const filePath = path.join(BATCH_RESULTS_DIR, fileName);
    
    // Create write stream
    const writer = fs.createWriteStream(filePath);
    
    // Pipe response to file
    response.data.pipe(writer);
    
    // Wait for file to be written
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Update batch metadata
    await updateBatchMetadata(batchId, {
      status: 'downloaded',
      resultFileName: fileName,
      resultFilePath: filePath,
      downloadedAt: new Date().toISOString()
    });
    
    console.log(`Successfully downloaded results for batch ${batchId}`);
    return {
      success: true,
      batchId,
      filePath
    };
  } catch (error) {
    console.error(`Error downloading results for batch ${batchId}:`, error);
    await updateBatchMetadata(batchId, {
      status: 'download_failed',
      error: error.message
    });
    throw error;
  }
}

/**
 * Process batch results and import into the database
 * 
 * @param {string} batchId - Internal batch ID
 * @param {boolean} convertToLeads - Whether to also convert properties to leads
 * @returns {Object} Processing results
 */
export async function processBatchResults(batchId, convertToLeads = true) {
  try {
    // Get batch metadata
    const batchMeta = await getBatchMetadata(batchId);
    if (!batchMeta) {
      throw new Error(`Batch ${batchId} not found`);
    }
    
    if (!batchMeta.resultFilePath || !fs.existsSync(batchMeta.resultFilePath)) {
      throw new Error(`Results file for batch ${batchId} not found`);
    }
    
    // Parse CSV results
    const properties = [];
    const stream = fs.createReadStream(batchMeta.resultFilePath)
      .pipe(csv());
    
    for await (const data of stream) {
      properties.push({
        ...data,
        source: 'attom',
        batchId
      });
    }
    
    console.log(`Read ${properties.length} properties from batch ${batchId} results`);
    
    // Update batch metadata
    await updateBatchMetadata(batchId, {
      status: 'processing',
      recordsFound: properties.length,
      processingStartedAt: new Date().toISOString()
    });
    
    // Process properties in bulk
    const results = await processPropertiesBulk(properties, 'attom');
    
    // Convert to leads if requested
    let leadResults = null;
    if (convertToLeads && results.processed.length > 0) {
      leadResults = await convertPropertiesToLeads(results.processed);
    }
    
    // Update batch metadata
    await updateBatchMetadata(batchId, {
      status: 'processed',
      processedRecords: results.processed.length,
      errorRecords: results.errors.length,
      leadsCreated: leadResults ? leadResults.leads.length : 0,
      processingCompletedAt: new Date().toISOString(),
      processingResults: JSON.stringify({
        propertyResults: results.summary,
        leadResults: leadResults ? leadResults.summary : null
      })
    });
    
    console.log(`Processed ${results.processed.length} properties from batch ${batchId}`);
    
    return {
      success: true,
      batchId,
      properties: results,
      leads: leadResults
    };
  } catch (error) {
    console.error(`Error processing results for batch ${batchId}:`, error);
    await updateBatchMetadata(batchId, {
      status: 'processing_failed',
      error: error.message
    });
    throw error;
  }
}

/**
 * Store batch metadata in database
 * 
 * @param {Object} batchMeta - Batch metadata
 */
async function storeBatchMetadata(batchMeta) {
  try {
    const sql = `
      INSERT INTO attom_batch_jobs (
        id, name, file_name, file_path, status, 
        record_count, created_at, external_batch_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.prisma.execute(sql, [
      batchMeta.id,
      batchMeta.name,
      batchMeta.fileName,
      batchMeta.filePath,
      batchMeta.status,
      batchMeta.recordCount,
      batchMeta.createdAt,
      batchMeta.externalBatchId
    ]);
  } catch (error) {
    console.error('Error storing batch metadata:', error);
    throw error;
  }
}

/**
 * Get batch metadata from database
 * 
 * @param {string} batchId - Batch ID
 * @returns {Object} Batch metadata
 */
async function getBatchMetadata(batchId) {
  try {
    const sql = `
      SELECT * FROM attom_batch_jobs
      WHERE id = ?
    `;
    
    const result = await db.prisma.executeGet(sql, [batchId]);
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      name: result.name,
      fileName: result.file_name,
      filePath: result.file_path,
      resultFileName: result.result_file_name,
      resultFilePath: result.result_file_path,
      status: result.status,
      recordCount: result.record_count,
      createdAt: result.created_at,
      externalBatchId: result.external_batch_id,
      submittedAt: result.submitted_at,
      estimatedCompletionTime: result.estimated_completion_time,
      response: result.response,
      error: result.error,
      attomStatus: result.attom_status,
      lastChecked: result.last_checked,
      progressPercent: result.progress_percent,
      downloadedAt: result.downloaded_at,
      processingStartedAt: result.processing_started_at,
      recordsFound: result.records_found,
      processedRecords: result.processed_records,
      errorRecords: result.error_records,
      leadsCreated: result.leads_created,
      processingCompletedAt: result.processing_completed_at
    };
  } catch (error) {
    console.error('Error getting batch metadata:', error);
    throw error;
  }
}

/**
 * Update batch metadata in database
 * 
 * @param {string} batchId - Batch ID
 * @param {Object} updates - Fields to update
 */
async function updateBatchMetadata(batchId, updates) {
  try {
    // Build SQL update statement dynamically
    const fields = Object.keys(updates).map(key => {
      // Convert camelCase to snake_case
      const snakeCase = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      return `${snakeCase} = ?`;
    });
    
    const values = Object.values(updates);
    
    if (fields.length === 0) {
      return;
    }
    
    const sql = `
      UPDATE attom_batch_jobs
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `;
    
    db.prisma.execute(sql, [...values, new Date().toISOString(), batchId]);
  } catch (error) {
    console.error('Error updating batch metadata:', error);
    throw error;
  }
}

/**
 * Get list of all batch jobs
 * 
 * @param {Object} options - Options for filtering and pagination
 * @returns {Array<Object>} List of batch jobs
 */
export async function listBatchJobs(options = {}) {
  try {
    const {
      status,
      limit = 100,
      offset = 0,
      sortBy = 'created_at',
      sortDir = 'DESC'
    } = options;
    
    let sql = `
      SELECT * FROM attom_batch_jobs
    `;
    
    const params = [];
    
    // Add status filter if provided
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    
    // Add sorting
    sql += ` ORDER BY ${sortBy} ${sortDir}`;
    
    // Add pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const results = await db.prisma.executeGetAll(sql, params);
    
    return results.map(row => ({
      id: row.id,
      name: row.name,
      fileName: row.file_name,
      status: row.status,
      recordCount: row.record_count,
      processedRecords: row.processed_records,
      errorRecords: row.error_records,
      leadsCreated: row.leads_created,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      downloadedAt: row.downloaded_at,
      completedAt: row.processing_completed_at,
      error: row.error
    }));
  } catch (error) {
    console.error('Error listing batch jobs:', error);
    throw error;
  }
}

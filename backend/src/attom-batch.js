#!/usr/bin/env node

/**
 * ATTOM Batch Integration Script
 * 
 * This script handles the end-to-end process of:
 * 1. Creating and submitting ATTOM batch requests
 * 2. Checking status and downloading results
 * 3. Processing results and converting to leads
 */

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import csv from 'csv-parser';
import { 
  createBatchRequest, 
  submitBatchRequest, 
  checkBatchStatus, 
  downloadBatchResults,
  processBatchResults,
  listBatchJobs
} from './services/attomBatchService.js';
import { configService } from './services/configService.js';

// Set up logging
const logFile = path.join(process.cwd(), 'logs', `leadflow-attom-batch-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const logDir = path.dirname(logFile);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Log to both console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  logStream.write(formattedMessage + '\n');
}

// Create CLI program
program
  .name('attom-batch')
  .description('ATTOM Batch Integration Script')
  .version('1.0.0');

// Command to create and submit a batch
program
  .command('submit <csv-file>')
  .description('Create and submit a batch request from a CSV file')
  .option('-n, --name <name>', 'Name for the batch')
  .option('-w, --wait', 'Wait for the batch to complete')
  .option('-p, --process', 'Process the results when complete')
  .option('-l, --leads', 'Convert processed properties to leads')
  .action(async (csvFile, options) => {
    try {
      log(`Starting batch submission from ${csvFile}`);
      
      // Read properties from CSV
      const properties = [];
      const stream = fs.createReadStream(csvFile).pipe(csv());
      
      for await (const data of stream) {
        properties.push(data);
      }
      
      log(`Read ${properties.length} properties from ${csvFile}`);
      
      // Create batch request
      log('Creating batch request...');
      const batch = await createBatchRequest(properties, options.name);
      
      // Submit batch request
      log('Submitting batch request...');
      const submitResult = await submitBatchRequest(batch.id);
      
      log(`Batch submitted successfully. Batch ID: ${batch.id}, ATTOM Job ID: ${submitResult.attomBatchId}`);
      log(`Estimated completion time: ${submitResult.estimatedTime} seconds`);
      
      // Wait for completion if requested
      if (options.wait) {
        log('Waiting for batch to complete...');
        
        let status = null;
        do {
          // Wait for 30 seconds before checking again
          await new Promise(resolve => setTimeout(resolve, 30000));
          
          status = await checkBatchStatus(batch.id);
          log(`Current status: ${status.status}, Progress: ${status.progress}%`);
        } while (status.status !== 'completed' && status.status !== 'failed');
        
        if (status.status === 'completed') {
          log('Batch processing completed successfully!');
          
          // Download results
          log('Downloading batch results...');
          const downloadResult = await downloadBatchResults(batch.id);
          
          if (downloadResult.success) {
            log(`Downloaded results to: ${downloadResult.filePath}`);
            
            // Process results if requested
            if (options.process) {
              log('Processing batch results...');
              const processResult = await processBatchResults(batch.id, options.leads);
              
              log(`Processed ${processResult.properties.processed.length} properties`);
              if (options.leads) {
                log(`Created ${processResult.leads.leads.length} leads`);
              }
              
              log('Batch processing complete!');
            }
          }
        } else {
          log(`Batch processing failed: ${status.error || 'Unknown error'}`);
        }
      } else {
        log(`Use the following command to check status: node attom-batch.js status ${batch.id}`);
      }
      
      log('Done!');
    } catch (error) {
      log(`Error: ${error.message}`);
      console.error(error);
      process.exit(1);
    } finally {
      logStream.end();
    }
  });

// Command to check batch status
program
  .command('status <batchId>')
  .description('Check the status of a batch request')
  .action(async (batchId) => {
    try {
      log(`Checking status of batch ${batchId}`);
      
      const status = await checkBatchStatus(batchId);
      
      log(`Status: ${status.status}`);
      log(`Progress: ${status.progress}%`);
      log(`Completed records: ${status.completedRecords} of ${status.totalRecords}`);
      
      if (status.status === 'completed') {
        log('Batch is ready for download');
      } else if (status.status === 'failed') {
        log(`Batch processing failed: ${status.error || 'Unknown error'}`);
      }
    } catch (error) {
      log(`Error: ${error.message}`);
      console.error(error);
      process.exit(1);
    } finally {
      logStream.end();
    }
  });

// Command to download batch results
program
  .command('download <batchId>')
  .description('Download the results of a batch request')
  .action(async (batchId) => {
    try {
      log(`Downloading results for batch ${batchId}`);
      
      const result = await downloadBatchResults(batchId);
      
      if (result.success) {
        log(`Downloaded results to: ${result.filePath}`);
      } else {
        log(`Failed to download results: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      log(`Error: ${error.message}`);
      console.error(error);
      process.exit(1);
    } finally {
      logStream.end();
    }
  });

// Command to process batch results
program
  .command('process <batchId>')
  .description('Process the results of a batch request')
  .option('-l, --leads', 'Convert processed properties to leads')
  .action(async (batchId, options) => {
    try {
      log(`Processing results for batch ${batchId}`);
      
      const result = await processBatchResults(batchId, options.leads);
      
      if (result.success) {
        log(`Processed ${result.properties.processed.length} properties`);
        log(`Errors: ${result.properties.errors.length}`);
        
        if (options.leads) {
          log(`Created ${result.leads.leads.length} leads`);
          log(`Lead creation errors: ${result.leads.errors.length}`);
        }
      } else {
        log(`Failed to process results: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      log(`Error: ${error.message}`);
      console.error(error);
      process.exit(1);
    } finally {
      logStream.end();
    }
  });

// Command to list all batches
program
  .command('list')
  .description('List all batch jobs')
  .option('-s, --status <status>', 'Filter by status')
  .option('-l, --limit <limit>', 'Limit number of results', parseInt, 100)
  .option('-o, --offset <offset>', 'Offset results', parseInt, 0)
  .action(async (options) => {
    try {
      log('Listing batch jobs');
      
      const batches = await listBatchJobs({
        status: options.status,
        limit: options.limit,
        offset: options.offset
      });
      
      log(`Found ${batches.length} batch jobs`);
      
      // Display as a table
      console.table(batches.map(batch => ({
        ID: batch.id.substring(0, 8) + '...',
        Name: batch.name,
        Status: batch.status,
        Records: batch.recordCount,
        Processed: batch.processedRecords || 0,
        Leads: batch.leadsCreated || 0,
        Created: new Date(batch.createdAt).toLocaleString(),
        Completed: batch.completedAt ? new Date(batch.completedAt).toLocaleString() : '-',
        Error: batch.error ? (batch.error.length > 20 ? batch.error.substring(0, 20) + '...' : batch.error) : '-'
      })));
    } catch (error) {
      log(`Error: ${error.message}`);
      console.error(error);
      process.exit(1);
    } finally {
      logStream.end();
    }
  });

// Command to run the full batch process
program
  .command('run-all <csv-file>')
  .description('Run the entire batch process from start to finish')
  .option('-n, --name <name>', 'Name for the batch')
  .option('-l, --leads', 'Convert processed properties to leads', true)
  .action(async (csvFile, options) => {
    try {
      log(`Starting full batch process from ${csvFile}`);
      
      // Read properties from CSV
      const properties = [];
      const stream = fs.createReadStream(csvFile).pipe(csv());
      
      for await (const data of stream) {
        properties.push(data);
      }
      
      log(`Read ${properties.length} properties from ${csvFile}`);
      
      // Create batch request
      log('1. Creating batch request...');
      const batch = await createBatchRequest(properties, options.name);
      
      // Submit batch request
      log('2. Submitting batch request...');
      const submitResult = await submitBatchRequest(batch.id);
      
      log(`Batch submitted successfully. Batch ID: ${batch.id}, ATTOM Job ID: ${submitResult.attomBatchId}`);
      log(`Estimated completion time: ${submitResult.estimatedTime} seconds`);
      
      // Wait for completion
      log('3. Waiting for batch to complete...');
      
      let status = null;
      let attempts = 0;
      const maxAttempts = 60; // 30 minutes (checking every 30 seconds)
      
      do {
        // Wait for 30 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        status = await checkBatchStatus(batch.id);
        log(`Current status: ${status.status}, Progress: ${status.progress}%`);
        
        attempts++;
        if (attempts >= maxAttempts) {
          log('Timeout waiting for batch to complete. Please check status manually.');
          return;
        }
      } while (status.status !== 'completed' && status.status !== 'failed');
      
      if (status.status === 'completed') {
        log('4. Batch processing completed successfully!');
        
        // Download results
        log('5. Downloading batch results...');
        const downloadResult = await downloadBatchResults(batch.id);
        
        if (downloadResult.success) {
          log(`Downloaded results to: ${downloadResult.filePath}`);
          
          // Process results
          log('6. Processing batch results...');
          const processResult = await processBatchResults(batch.id, options.leads);
          
          log(`Processed ${processResult.properties.processed.length} properties`);
          if (options.leads) {
            log(`Created ${processResult.leads.leads.length} leads`);
          }
          
          log('Batch processing complete!');
        }
      } else {
        log(`Batch processing failed: ${status.error || 'Unknown error'}`);
      }
      
      log('Done!');
    } catch (error) {
      log(`Error: ${error.message}`);
      console.error(error);
      process.exit(1);
    } finally {
      logStream.end();
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

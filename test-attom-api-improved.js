import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ATTOM API configuration
const API_KEY = 'eb0962f943f5245054cec189feb1469b';
const BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

// Helper function for ATTOM API requests
async function attomRequest(endpoint, params) {
    console.log(`Making request to ${endpoint} with params:`, params);
    try {
        const response = await axios.get(`${BASE_URL}/${endpoint}`, {
            params,
            headers: {
                'Accept': 'application/json',
                'apikey': API_KEY
            },
            allowAbsoluteUrls: true
        });
        return response.data;
    } catch (error) {
        console.error(`Error in ATTOM API request to ${endpoint}:`, error.message);
        if (error.response) {
            console.log(`Response status: ${error.response.status}`);
            console.log(`Response data:`, JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

// Save response to file for analysis
async function saveResponseToFile(filename, data) {
    try {
        const outputPath = path.join(__dirname, filename);
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
        console.log(`Data saved to ${outputPath}`);
    } catch (error) {
        console.error(`Error saving data to file:`, error);
    }
}

// Function to explore and analyze the structure of property data
async function explorePropertyData(attomId) {
    console.log(`\n=== EXPLORING PROPERTY DATA FOR ATTOM ID: ${attomId} ===\n`);
    
    try {
        console.log('Fetching basic property details...');
        const propertyDetail = await attomRequest('property/detail', { attomid: attomId });
        await saveResponseToFile(`property_detail_${attomId}.json`, propertyDetail);
        
        // Let's analyze the property detail structure
        console.log('\n=== PROPERTY DETAIL STRUCTURE ANALYSIS ===\n');
        analyzeDataStructure(propertyDetail, 'property/detail');
        
        console.log('\nFetching expanded property profile...');
        const expandedProfile = await attomRequest('property/expandedprofile', { attomid: attomId });
        await saveResponseToFile(`property_expandedprofile_${attomId}.json`, expandedProfile);
        
        // Let's analyze the expanded profile structure
        console.log('\n=== EXPANDED PROFILE STRUCTURE ANALYSIS ===\n');
        analyzeDataStructure(expandedProfile, 'property/expandedprofile');
        
        // Let's try other endpoints
        try {
            console.log('\nFetching property sale info...');
            const saleInfo = await attomRequest('sale/snapshot', { id: attomId });
            await saveResponseToFile(`property_sale_${attomId}.json`, saleInfo);
            analyzeDataStructure(saleInfo, 'sale/snapshot');
        } catch (error) {
            console.log(`Sale info not available: ${error.message}`);
        }
        
        try {
            console.log('\nFetching property assessment info...');
            const assessmentInfo = await attomRequest('assessment/snapshot', { id: attomId });
            await saveResponseToFile(`property_assessment_${attomId}.json`, assessmentInfo);
            analyzeDataStructure(assessmentInfo, 'assessment/snapshot');
        } catch (error) {
            console.log(`Assessment info not available: ${error.message}`);
        }

    } catch (error) {
        console.error('Error exploring property data:', error);
    }
    
    console.log('\nExploration completed.');
}

// Function to analyze the structure of a data object and find important fields
function analyzeDataStructure(data, endpoint) {
    console.log(`Analyzing data structure for ${endpoint}:`);
    
    // Check if we have a valid property response
    if (!data || !data.property) {
        console.log('No property data found in response');
        console.log('Response structure:', JSON.stringify(Object.keys(data || {}), null, 2));
        return;
    }
    
    // Get the property object(s)
    const properties = Array.isArray(data.property) ? data.property : [data.property];
    
    console.log(`Found ${properties.length} properties in the response`);
    
    // Analyze the first property
    if (properties.length > 0) {
        const property = properties[0];
        console.log('Top-level fields in property:', Object.keys(property));
        
        // Check for specific fields that might be useful
        checkField(property, 'address');
        checkField(property, 'assessment');
        checkField(property, 'building');
        checkField(property, 'lot');
        checkField(property, 'vintage');
        checkField(property, 'sale');
        checkField(property, 'area');
        checkField(property, 'utilities');
        checkField(property, 'identifier');
        
        // Deeply analyze the structure to find all available fields
        console.log('\nFull property field structure:');
        analyzeNestedStructure(property, '');
    }
}

// Check if a field exists and show its structure
function checkField(obj, field) {
    if (obj[field]) {
        console.log(`\nField "${field}" exists with structure:`, Object.keys(obj[field]));
    } else {
        console.log(`\nField "${field}" does not exist`);
    }
}

// Recursively analyze nested structure
function analyzeNestedStructure(obj, prefix, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth || obj === null || typeof obj !== 'object') {
        return;
    }
    
    for (const key in obj) {
        const value = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        
        if (value === null) {
            console.log(`${path}: null`);
        } else if (Array.isArray(value)) {
            console.log(`${path}: Array[${value.length}]`);
            if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                analyzeNestedStructure(value[0], `${path}[0]`, maxDepth, currentDepth + 1);
            }
        } else if (typeof value === 'object') {
            console.log(`${path}: Object`);
            analyzeNestedStructure(value, path, maxDepth, currentDepth + 1);
        } else {
            console.log(`${path}: ${typeof value} (${value.toString().substring(0, 50)})`);
        }
    }
}

// Main execution
const attomId = '42116';
explorePropertyData(attomId);

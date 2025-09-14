#!/usr/bin/env node

// Script to test the API routes

import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';

// Helper function to make API calls
async function callApi(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error calling API ${endpoint}:`, error);
    return { status: 500, error };
  }
}

// Test all API endpoints
async function runTests() {
  console.log('Testing API endpoints...');
  
  // Test basic health endpoint
  console.log('\nTesting health endpoint...');
  const healthResponse = await callApi('/health');
  console.log('Response:', healthResponse);
  
  // Test search endpoint
  console.log('\nTesting search endpoint...');
  const searchResponse = await callApi('/zip-search-new/search?limit=5');
  console.log(`Found ${searchResponse.data?.pagination?.total || 0} leads`);
  console.log('First few leads:', searchResponse.data?.leads?.slice(0, 2));
  
  // Test searching by zip code
  console.log('\nTesting zip code search...');
  const zipSearchBody = { zipCode: '85001' };
  const zipSearchResponse = await callApi('/zip-search-new/search-zip', 'POST', zipSearchBody);
  console.log(`Found ${zipSearchResponse.data?.leadCount || 0} leads in zip code ${zipSearchBody.zipCode}`);
  
  // Test revenue analytics
  console.log('\nTesting revenue analytics...');
  const analyticsResponse = await callApi('/zip-search-new/revenue-analytics');
  console.log('Analytics:', analyticsResponse.data?.analytics);
  
  // Test database connection
  console.log('\nTesting direct database connection...');
  try {
    // Create a new PrismaClient that directly targets the SQLite database
    // Directly override the provider to use sqlite
    const { PrismaClient: PrismaClientOriginal } = await import('@prisma/client');
    
    // Create a temporary Prisma schema file for testing
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = os.tmpdir();
    const schemaPath = path.join(tempDir, 'temp-schema.prisma');
    
    const schemaContent = `
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "sqlite"
      url      = "file:../prisma/dev.db"
    }
    
    model Lead {
      id               String   @id @default(cuid())
      address          String
      owner_name       String?
      phone            String?
      email            String?
      source_type      String
      motivation_score Int      @default(0)
      estimated_value  Float?
      equity           Float?
      condition_score  Int      @default(50)
      tax_debt         Float    @default(0)
      violations       Int      @default(0)
      is_probate       Boolean  @default(false)
      is_vacant        Boolean  @default(false)
      days_on_market   Int?
      lead_score       Int      @default(0)
      temperature_tag  String   @default("warm")
      status           String   @default("new")
      notes            String?
      created_at       DateTime @default(now())
      updated_at       DateTime @updatedAt
    
      @@map("leads")
    }
    `;
    
    fs.writeFileSync(schemaPath, schemaContent);
    
    console.log('Created temporary schema file for SQLite testing');
    
    // Use direct path to SQLite database based on the find result
    const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
    console.log(`Attempting to connect to SQLite database at: ${dbPath}`);
    
    // Now we can make direct SQL queries to the SQLite database
    try {
      const Database = (await import('better-sqlite3')).default;
      
      // Check if the file exists first
      if (!fs.existsSync(dbPath)) {
        console.log(`Database file not found at ${dbPath}`);
        console.log('Checking for alternative locations...');
        
        // Try alternative paths
        const altPath1 = path.resolve(__dirname, '../..', 'prisma', 'dev.db');
        const altPath2 = path.resolve(process.cwd(), 'prisma', 'dev.db');
        
        if (fs.existsSync(altPath1)) {
          console.log(`Database found at ${altPath1}`);
          const db = new Database(altPath1, { readonly: true });
          return db;
        } else if (fs.existsSync(altPath2)) {
          console.log(`Database found at ${altPath2}`);
          const db = new Database(altPath2, { readonly: true });
          return db;
        } else {
          throw new Error(`Could not find database file in common locations`);
        }
      }
      
      const db = new Database(dbPath, { readonly: true });
      return db;
    } catch (error) {
      console.error('Error opening database:', error);
      throw error;
    }
    
    // Check if the leads table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in database:', tables.map(t => t.name));
    
    // Count leads if the table exists
    if (tables.some(t => t.name === 'leads')) {
      const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get();
      console.log(`Database connection successful. Found ${leadCount.count} leads.`);
      
      if (leadCount.count > 0) {
        const sampleLead = db.prepare('SELECT * FROM leads LIMIT 1').get();
        console.log('Sample lead fields:', Object.keys(sampleLead));
        console.log('Sample lead:', JSON.stringify(sampleLead, null, 2));
      }
    } else {
      console.log('Leads table not found in the database.');
    }
    
    // Close the database connection
    db.close();
  } catch (dbError) {
    console.error('Database connection error:', dbError);
  }
  
  // Cleanup
  await prisma.$disconnect();
  
  console.log('\nTests completed!');
}

runTests().catch(console.error);

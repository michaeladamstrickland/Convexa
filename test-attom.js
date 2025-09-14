import { PrismaClient } from '@prisma/client';
import attomClient from './src/services/attomClient.ts';

const prisma = new PrismaClient();

async function testAttomClient() {
  try {
    console.log('Testing ATTOM Client...');
    
    // Test property lookup by address
    const property = await attomClient.getPropertyByAddress(
      '123 Main St',
      'Beverly Hills',
      'CA',
      '90210'
    );
    
    console.log('ATTOM API Response:', property ? 'Success' : 'Not found');
    if (property) {
      console.log('Property details:', JSON.stringify(property, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing ATTOM client:', error);
    process.exit(1);
  }
}

testAttomClient();

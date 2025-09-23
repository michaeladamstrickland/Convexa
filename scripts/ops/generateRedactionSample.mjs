import { redactPIIInObject } from '../../src/utils/piiRedactor.ts';
import fs from 'fs/promises';
import path from 'path';

async function generateSample() {
  const dummyLogData = {
    method: 'POST',
    path: '/api/leads/create',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    body: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '555-123-4567',
      ssn: '123-45-6789',
      creditCard: '1234-5678-9012-3456',
      apiKey: 'supersecretapikey12345',
      address: '123 Main St, Anytown, USA',
      leadId: 'lead_a1b2c3d4-e5f6-7890-1234-567890abcdef',
      jobId: 'job_f9e8d7c6-b5a4-3210-fedc-ba9876543210',
      notes: 'Customer called about property at 123 Main St. Email: john.doe@example.com',
      nested: {
        secretToken: 'nestedsecrettokenabc',
        anotherEmail: 'nested.email@test.com'
      }
    },
    response: {
      status: 200,
      data: {
        message: 'Lead created successfully',
        leadId: 'lead_a1b2c3d4-e5f6-7890-1234-567890abcdef',
        ownerEmail: 'john.doe@example.com'
      }
    }
  };

  const redactedLogData = redactPIIInObject(dummyLogData);

  const outputFilePath = path.resolve(process.cwd(), 'ops', 'findings', 'redaction_sample.txt');
  await fs.writeFile(outputFilePath, JSON.stringify(redactedLogData, null, 2), 'utf8');

  console.log(`Sanitized log sample written to: ${outputFilePath}`);
}

generateSample();

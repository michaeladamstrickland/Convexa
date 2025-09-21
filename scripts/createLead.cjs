const axios = require('axios');
const { Command } = require('commander');

const createLeadCommand = new Command();
createLeadCommand
  .option('--address <address>', 'Address for the lead')
  .option('--owner <owner>', 'Owner for the lead')
  .option('--port <port>', 'Port for the backend server', '6025');

async function createLead(cliOptions) {
  const resolvedOptions = cliOptions || createLeadCommand.opts();
  const ADDRESS = resolvedOptions.address;
  const OWNER = resolvedOptions.owner;
  const PORT = resolvedOptions.port;
  const BASE_URL = `http://localhost:${PORT}`;

  if (!ADDRESS || !OWNER) {
    console.error('Error: --address and --owner are required.');
    if (require.main === module) process.exit(1);
    else throw new Error('Address and owner are required.');
  }

  const payload = {
    address: ADDRESS,
    owner: OWNER,
    condition_score: 50, // Default value
    status: 'new',       // Default value
    // Add other known columns if necessary, but only those that are part of the schema
  };

  try {
    console.log(`Attempting to create lead via HTTP POST to ${BASE_URL}/api/zip-search-new/add-lead`);
    const response = await axios.post(`${BASE_URL}/api/zip-search-new/add-lead`, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000, // 5 second timeout for HTTP requests
    });

    if (response.data && response.data.leadId) {
      console.log(`Lead created successfully. Lead ID: ${response.data.leadId}`);
      return response.data.leadId;
    } else {
      console.error('Error: Lead ID not found in response.', response.data);
      if (require.main === module) process.exit(1);
      else throw new Error('Lead ID not found in response.');
    }
  } catch (error) {
    console.error(`Error creating lead: ${error.message}`);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    if (require.main === module) process.exit(1);
    else throw error;
  }
}

if (require.main === module) {
  createLeadCommand.parse(process.argv);
  createLead();
} else {
  module.exports = createLead;
}

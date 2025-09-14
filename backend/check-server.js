const axios = require('axios');

async function checkServer() {
  try {
    console.log('Checking ATTOM server status...');
    const response = await axios.get('http://localhost:5001/api/attom/status');
    console.log('Server response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('Server error:', error.message);
    return false;
  }
}

checkServer();

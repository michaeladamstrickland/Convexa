// WebSocket Test Script (non-interactive)
// This script tests the WebSocket connection to the scraper server

import WebSocket from 'ws';

// Configuration
const wsUrl = 'ws://localhost:3000/api/ws/scraper';
const userId = 'tester';
const fullUrl = `${wsUrl}?userId=${userId}`;

console.log('Starting WebSocket test...');
console.log(`Connecting to: ${fullUrl}`);

// Create WebSocket connection
const ws = new WebSocket(fullUrl);

// Connection opened
ws.on('open', () => {
  console.log('Connection established!');
  console.log('Sending ping message...');
  
  // Send a ping message
  ws.send(JSON.stringify({
    type: 'ping',
    timestamp: new Date().toISOString()
  }));
});

// Listen for messages
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('Received message:', JSON.stringify(message, null, 2));
    
    // If we get a pong message, test is successful
    if (message.type === 'pong') {
      console.log('Ping-pong successful!');
      console.log('WebSocket connection is working properly.');
      
      // Close after success
      setTimeout(() => {
        ws.close();
        process.exit(0);
      }, 1000);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

// Handle errors
ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
  process.exit(1);
});

// Connection closed
ws.on('close', (code, reason) => {
  console.log(`Connection closed with code ${code}${reason ? `: ${reason}` : ''}`);
  process.exit(code === 1000 ? 0 : 1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('Test timed out. Closing connection...');
  ws.close();
  process.exit(1);
}, 10000);

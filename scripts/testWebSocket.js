// WebSocket Test Script
// This script tests the WebSocket connection to the scraper server

import WebSocket from 'ws';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function startWebSocketTest() {
  console.log('Starting WebSocket test...');
  
  // Ask for the WebSocket server URL
  rl.question('WebSocket URL (default: ws://localhost:3000/api/ws/scraper): ', (url) => {
    const wsUrl = url || 'ws://localhost:3000/api/ws/scraper';
    
    // Ask for a user ID
    rl.question('User ID (default: tester): ', (userId) => {
      const id = userId || 'tester';
      const fullUrl = `${wsUrl}?userId=${id}`;
      
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
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
      });
      
      // Connection closed
      ws.on('close', (code, reason) => {
        console.log(`Connection closed with code ${code}${reason ? `: ${reason}` : ''}`);
        rl.close();
      });
      
      // Wait for 10 seconds then close
      setTimeout(() => {
        console.log('Test complete. Closing connection...');
        ws.close();
      }, 10000);
    });
  });
}

// Start the test
startWebSocketTest();

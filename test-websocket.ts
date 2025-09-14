/**
 * Test script for WebSocket functionality
 * 
 * This script tests the real-time updates via WebSockets for scraper jobs.
 */
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Define WebSocket URL and authentication token
const WS_URL = process.env.WS_URL || 'ws://localhost:5000/ws/scraper';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || ''; // Add test token in .env file

/**
 * Run WebSocket tests
 */
async function runWebSocketTests() {
  console.log('===== STARTING WEBSOCKET TESTS =====');
  
  // Generate a unique client ID for this test
  const clientId = uuidv4();
  
  // Create WebSocket connection with authentication
  const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}&clientId=${clientId}`);
  
  // Setup event handlers
  ws.on('open', () => {
    console.log('WebSocket connection established');
    
    // Send a subscription message
    const subscribeMsg = {
      type: 'subscribe',
      channel: 'scraper_jobs',
      data: {
        clientId
      }
    };
    
    ws.send(JSON.stringify(subscribeMsg));
    console.log('Sent subscription request:', subscribeMsg);
    
    // Send a ping to test the connection
    setTimeout(() => {
      const pingMsg = {
        type: 'ping',
        data: {
          timestamp: new Date().toISOString()
        }
      };
      ws.send(JSON.stringify(pingMsg));
      console.log('Sent ping message');
    }, 1000);
    
    // Set up a simple heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
        console.log('Sent heartbeat');
      }
    }, 30000);
    
    // Clean up interval on close
    ws.on('close', () => clearInterval(heartbeatInterval));
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('\nReceived message:');
      console.log(JSON.stringify(message, null, 2));
      
      if (message.type === 'job_update') {
        console.log(`Job update received for job: ${message.data.jobId}`);
      } else if (message.type === 'pong') {
        console.log('Received pong response');
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      console.log('Raw message:', data.toString());
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed with code ${code}${reason ? ': ' + reason : ''}`);
  });
  
  // Run for a specified period then close
  const testDuration = 60000; // 1 minute
  console.log(`WebSocket test will run for ${testDuration / 1000} seconds`);
  
  setTimeout(() => {
    console.log('Test duration complete, closing WebSocket');
    ws.close(1000, 'Test complete');
    console.log('\n===== WEBSOCKET TESTS COMPLETED =====');
  }, testDuration);
}

// Run the tests
runWebSocketTests().catch(console.error);

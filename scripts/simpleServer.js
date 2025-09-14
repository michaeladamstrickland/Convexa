/**
 * simpleServer.js
 * A simple Express server for testing
 */

import express from 'express';

const app = express();
const PORT = 3030;

// Simple route
app.get('/', (req, res) => {
  res.send('Hello from LeadFlow AI');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

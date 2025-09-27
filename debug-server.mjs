import { startServer } from './backend/integrated-server.js';

console.log('Attempting to start server...');
try {
  const app = await startServer({ listen: true });
  console.log('Server started successfully');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
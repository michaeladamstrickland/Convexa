// Simple Express Server for LeadFlow AI Frontend Demo
// Basic server to connect React frontend with mock API endpoints

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import masterRoutes from './routes/masterRoutes_new';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.DEMO_PORT || 5001;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api', masterRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'LeadFlow AI Demo Server',
    apis: 26,
    tier: 'demo'
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LeadFlow AI Demo Server running on port ${PORT}`);
  console.log(`📊 Demo Mode: Frontend Integration Ready`);
  console.log(`🎯 Mock APIs: 26 Premium Data Sources`);
  console.log(`🌐 Frontend should connect to: http://localhost:${PORT}`);
  console.log(`\n🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 System Status: http://localhost:${PORT}/api/system/status`);
  console.log(`🔗 Cost Estimate: http://localhost:${PORT}/api/system/cost-estimate`);
});

export default app;

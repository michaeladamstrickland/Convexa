import express from 'express';
import cors from 'cors';
import { json, urlencoded } from 'body-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import dealRoutes from './routes/dealRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet()); // Security headers
app.use(cors());   // CORS support
app.use(json({ limit: '10mb' })); // JSON body parser with larger limit for reports
app.use(urlencoded({ extended: true }));
app.use(morgan('dev')); // Logging

// API Routes
app.use('/api', dealRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

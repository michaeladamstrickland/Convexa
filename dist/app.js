import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import propertySearchRoutes from './routes/propertySearchRoutes';
import systemRoutes from './routes/systemRoutes';
// Load environment variables
dotenv.config();
// Initialize express app
const app = express();
// Middleware
app.use(cors());
app.use(express.json());
// Routes
app.use('/api', propertySearchRoutes);
app.use('/api/system', systemRoutes);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});
// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
export default app;
//# sourceMappingURL=app.js.map
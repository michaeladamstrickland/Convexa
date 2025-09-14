import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Placeholder routes - implement as needed
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Calls API' });
});

export default router;

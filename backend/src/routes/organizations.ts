import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use((req, res, next) => {
  authenticate(req as any, res, next).catch(next);
});

router.get('/', (req, res) => {
  res.json({ success: true, message: 'Organizations API' });
});

export default router;

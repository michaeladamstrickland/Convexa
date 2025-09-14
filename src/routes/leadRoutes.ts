import express from 'express';
import { handleLeadFeedback, handleLeadScoring } from '../controllers/leadTemperatureController';

const router = express.Router();

// POST /api/leads/:id/feedback - Submit feedback on a lead
router.post('/:id/feedback', handleLeadFeedback);

// POST /api/leads/:id/score - Calculate and update AI score for a lead
router.post('/:id/score', handleLeadScoring);

export default router;

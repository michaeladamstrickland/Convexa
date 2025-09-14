import express from 'express';
import { MasterRealEstateService } from '../services/masterRealEstateService';

const router = express.Router();
const masterService = new MasterRealEstateService();

// POST /api/leadflow/generate-lead
router.post('/generate-lead', async (req, res) => {
  try {
    const { address, county, probateStart, probateEnd } = req.body;
    const lead = await masterService.generateLead(address, county, probateStart, probateEnd);
    res.json(lead);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

export default router;

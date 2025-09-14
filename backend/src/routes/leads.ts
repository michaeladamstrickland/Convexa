import { Router } from 'express';
import { authenticate, restrictTo } from '../middleware/auth';
import { validateSchema, leadSchemas } from '../middleware/validation';
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  runSkipTrace,
  addLeadNote,
  getLeadStats,
  generateCallScript,
} from '../controllers/leadController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Lead CRUD operations
router.get('/', validateSchema(leadSchemas.search), getLeads);
router.post('/', validateSchema(leadSchemas.create), createLead);
router.get('/stats', getLeadStats);
router.get('/:id', getLead);
router.patch('/:id', validateSchema(leadSchemas.update), updateLead);
router.delete('/:id', restrictTo('admin', 'manager'), deleteLead);

// Lead actions
router.post('/:id/skip-trace', runSkipTrace);
router.post('/:id/notes', addLeadNote);

// Custom endpoint for ATTOM lead creation
router.post('/add-lead', (req, res, next) => {
  // Set source to identify where the lead came from
  req.body.source = 'manual-attom';
  
  // Log the request
  console.log('Adding new lead from ATTOM', { 
    address: req.body.address,
    city: req.body.city,
    state: req.body.state
  });
  
  // Use the existing controller
  createLead(req, res, next);
});
router.get('/:id/call-script', generateCallScript);

export default router;

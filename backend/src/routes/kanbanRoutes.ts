import { Router } from 'express';
import { 
  getKanbanBoard,
  updateLeadStatus,
  addLeadNote,
  getLeadActivity 
} from '../controllers/kanbanController';

const router = Router();

/**
 * @route   GET /api/kanban
 * @desc    Get the Kanban board with all leads
 * @access  Private
 */
router.get('/', getKanbanBoard);

/**
 * @route   PATCH /api/kanban/leads/:id/status
 * @desc    Update lead status
 * @access  Private
 */
router.patch('/leads/:id/status', updateLeadStatus);

/**
 * @route   POST /api/kanban/leads/:id/note
 * @desc    Add a note to a lead
 * @access  Private
 */
router.post('/leads/:id/note', addLeadNote);

/**
 * @route   GET /api/kanban/leads/:id/activity
 * @desc    Get activity log for a lead
 * @access  Private
 */
router.get('/leads/:id/activity', getLeadActivity);

export default router;

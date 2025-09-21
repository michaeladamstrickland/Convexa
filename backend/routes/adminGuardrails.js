import express from 'express';
import { guardrailsSnapshot } from '../../infra/guardrails.js';

export default function createAdminGuardrailsRouter(db) {
  const router = express.Router();

  router.get('/guardrails-state', (req, res) => {
    try { res.json({ success: true, data: guardrailsSnapshot() }); }
    catch (e) { res.status(500).json({ success: false, error: e?.message || String(e) }); }
  });

  router.post('/skiptrace-runs/:runId/resume', (req, res) => {
    try {
      const runId = req.params.runId;
      const row = db.prepare('SELECT run_id FROM skiptrace_runs WHERE run_id = ?').get(runId);
      if (!row) return res.status(404).json({ success: false, error: 'Run not found' });
      db.prepare('UPDATE skiptrace_runs SET soft_paused = 0 WHERE run_id = ?').run(runId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  return router;
}

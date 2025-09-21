import { Router } from 'express';
import { prisma } from '../db/prisma';
import { DealAnalysis, computeArvFromComps, computeRoi } from '../../shared/types/deal';

const router = Router();

// Helper: get or create a simple DealAnalysis row stored in DealAnalysis table with JSON field
async function getDealRow(leadId: string) {
  const row: any = await (prisma as any).dealAnalysis.findFirst({ where: { lead_id: leadId } }).catch(() => null);
  return row;
}

// GET /api/deals/:leadId
router.get('/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params as { leadId: string };
    let row: any = await getDealRow(leadId);
    if (!row) {
      // Seed with a minimal default based on Lead
      const lead: any = await (prisma as any).lead.findUnique({ where: { id: leadId } }).catch(() => null);
      const now = new Date().toISOString();
      const deal: DealAnalysis = {
        leadId,
        source: 'Manual',
        temperature: (lead?.temperature_tag || 'WARM') as any,
        property: {
          address: lead?.address || '',
          city: '', state: '', zip: '',
          beds: undefined, baths: undefined, sqft: undefined,
          estValue: lead?.estimated_value || undefined,
        },
        purchase: { offerPrice: Math.round(lead?.estimated_value ? (lead.estimated_value * 0.7) : 0), closingCostsPct: 0.02, holdingMonths: 4, rateAPR: 0.10, sellingCostsPct: 0.06 },
        renovation: { budget: 25000, lineItems: [] },
        comps: [],
        results: { totalInvestment: 0, netProfit: 0, roiPct: 0, riskScore: 50, recommendation: 'REVIEW' },
        createdAt: now, updatedAt: now,
      };
      // Persist stub for future updates
      row = await (prisma as any).dealAnalysis.create({ data: { lead_id: leadId, analysis_json: JSON.stringify(deal) } }).catch(() => null);
    }
    const deal: DealAnalysis = typeof row.analysis_json === 'string' ? JSON.parse(row.analysis_json) : row.analysis_json;
    return res.json(deal);
  } catch (e: any) {
    return res.status(500).json({ error: 'deal_get_failed', message: e?.message });
  }
});

// PUT /api/deals/:leadId
router.put('/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params as { leadId: string };
    const data: DealAnalysis = req.body;
    await (prisma as any).dealAnalysis.upsert({
      where: { id: (await getDealRow(leadId))?.id || '___absent___' },
      update: { analysis_json: JSON.stringify(data), updated_at: new Date() },
      create: { lead_id: leadId, analysis_json: JSON.stringify(data) },
    });
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ error: 'deal_save_failed', message: e?.message });
  }
});

// POST /api/deals/:leadId/run — recompute ARV/ROI; optionally fetch ATTOM comps (mocked)
router.post('/:leadId/run', async (req, res) => {
  try {
    const { leadId } = req.params as { leadId: string };
    const feedback = (req.body?.feedback || {}) as { removedCompIds?: string[]; userArv?: number; userBudget?: number };
    const existingRow: any = await getDealRow(leadId);
    if (!existingRow) return res.status(404).json({ error: 'deal_not_found' });
    const deal: DealAnalysis = typeof existingRow.analysis_json === 'string' ? JSON.parse(existingRow.analysis_json) : existingRow.analysis_json;

    const attomAvailable = String(process.env.FEATURE_ATTOM_ENABLED || 'true') === 'true';
    const errors: string[] = [];

    // Mock comps: derive a few comps around estValue if sqft is present
    let comps = deal.comps || [];
    if (attomAvailable && (deal.property.sqft || 0) > 0) {
      const base = Math.round((deal.property.estValue || 250000) / Math.max(deal.property.sqft || 1500, 1));
      const sqft = deal.property.sqft || 1500;
      comps = [
        { address: `${deal.property.address} #A`, distanceMi: 0.4, salePrice: (base+20)*sqft, saleDate: new Date().toISOString(), beds: deal.property.beds||3, baths: deal.property.baths||2, sqft },
        { address: `${deal.property.address} #B`, distanceMi: 0.8, salePrice: (base-15)*sqft, saleDate: new Date().toISOString(), beds: deal.property.beds||3, baths: deal.property.baths||2, sqft },
        { address: `${deal.property.address} #C`, distanceMi: 1.1, salePrice: (base+5)*sqft, saleDate: new Date().toISOString(), beds: deal.property.beds||3, baths: deal.property.baths||2, sqft },
      ];
      // apply exclusions
      const removed = new Set((feedback.removedCompIds || []).map(String));
      comps = comps.filter(c => !removed.has(c.address));
    }

    // Compute ARV
    if (feedback.userArv && feedback.userArv > 0) {
      deal.property.arv = feedback.userArv;
    } else if (comps.length && (deal.property.sqft || 0) > 0) {
      const { arv, adjusted } = computeArvFromComps(deal.property.sqft || 0, comps);
      deal.property.arv = arv;
      comps = adjusted;
    }

    // Update renovation budget if user provided
    if (typeof feedback.userBudget === 'number') {
      deal.renovation.budget = feedback.userBudget;
    }

    // Recompute ROI if we have ARV
    if (deal.property.arv) {
      const roi = computeRoi(
        deal.property.arv,
        deal.purchase.offerPrice,
        deal.renovation.budget,
        deal.purchase.closingCostsPct,
        deal.purchase.sellingCostsPct,
        deal.purchase.holdingMonths,
        deal.purchase.rateAPR || 0.10
      );
      deal.results = { ...deal.results, ...roi } as any;
    }

    // Persist updates
    deal.comps = comps as any;
    deal.updatedAt = new Date().toISOString();
    await (prisma as any).dealAnalysis.update({ where: { id: existingRow.id }, data: { analysis_json: JSON.stringify(deal) } });
    return res.json({ dealData: deal, attomAvailable, errors });
  } catch (e: any) {
    return res.status(500).json({ error: 'deal_run_failed', message: e?.message });
  }
});

// GET /api/deals/comps?address=&radius=
router.get('/comps', async (req, res) => {
  try {
    const { address = '', radius = '1' } = req.query as Record<string,string>;
    const r = parseFloat(radius) || 1;
    // Mock response for now
    const comps = [
      { address: `${address} A`, distanceMi: Math.min(0.5, r), salePrice: 350000, saleDate: new Date().toISOString(), beds: 3, baths: 2, sqft: 1500 },
      { address: `${address} B`, distanceMi: Math.min(0.9, r), salePrice: 365000, saleDate: new Date().toISOString(), beds: 3, baths: 2, sqft: 1520 },
      { address: `${address} C`, distanceMi: Math.min(1.2, r), salePrice: 340000, saleDate: new Date().toISOString(), beds: 3, baths: 2, sqft: 1490 },
    ];
    return res.json({ comps });
  } catch (e: any) {
    return res.status(500).json({ error: 'comps_failed', message: e?.message });
  }
});

// GET /api/deals/:leadId/export?format=pdf|csv
router.get('/:leadId/export', async (req, res) => {
  try {
    const { leadId } = req.params as { leadId: string };
    const { format = 'pdf' } = req.query as Record<string,string>;
    const row: any = await getDealRow(leadId);
    if (!row) return res.status(404).json({ error: 'deal_not_found' });
    const deal: DealAnalysis = typeof row.analysis_json === 'string' ? JSON.parse(row.analysis_json) : row.analysis_json;
    if (format === 'csv') {
      const headers = ['field','value'];
      const csv = [headers.join(',')].concat([
        ['address', deal.property.address],
        ['offerPrice', String(deal.purchase.offerPrice)],
        ['renovationBudget', String(deal.renovation.budget)],
        ['arv', String(deal.property.arv || '')],
        ['roiPct', String(deal.results.roiPct || '')],
      ].map(r => r.map(v => /[",\n]/.test(String(v)) ? '"'+String(v).replace(/"/g,'""')+'"' : String(v)).join(','))).join('\n');
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="deal-${leadId}.csv"`);
      return res.status(200).send(csv);
    }
    // Minimal PDF fallback: return JSON with content-type for now
    res.setHeader('Content-Type','application/pdf');
    const blob = Buffer.from(JSON.stringify({ deal, note: 'PDF generation not implemented in dev' }));
    return res.status(200).send(blob);
  } catch (e: any) {
    return res.status(500).json({ error: 'export_failed', message: e?.message });
  }
});

export default router;

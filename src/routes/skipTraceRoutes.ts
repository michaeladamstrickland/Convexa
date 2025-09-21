import { Router } from 'express';
import { prisma } from '../db/prisma';
import batchSkipTraceService from '../services/batchSkipTraceService';
import { normalizeAddress } from '../utils/addressNormalization';

type SkipTraceServiceRequest = {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  firstName?: string;
  lastName?: string;
};

type SkipTraceResultFE = {
  leadId: string;
  providersTried: string[];
  cost: number;
  contacts: {
    phones: Array<{
      value: string;
      type?: string;
      confidence: number;
      dnc?: boolean;
      lastSeen?: string;
      source?: string;
    }>;
    emails: Array<{
      value: string;
      confidence: number;
      dnc?: boolean;
      lastSeen?: string;
      source?: string;
    }>;
  };
  compliance: {
    quietHours: boolean;
    leadTimezone?: string;
    dncSuppressed?: number;
  };
};

type BulkSkipTraceResultFE = {
  summary: {
    requested: number;
    processed: number;
    hits: number;
    noHits: number;
    suppressed: number;
    cost: number;
  };
  results: Array<{
    leadId: string;
    status: 'success' | 'no_hit' | 'suppressed' | 'error';
    matches: number;
    cost: number;
  }>;
};

// In-memory metrics to satisfy FE dashboards
const skipMetrics = (global as any).__SKIP_TRACE_METRICS__ || {
  traces: 0,
  hits: 0,
  cost: 0,
  providers: new Map<string, { hits: number; traces: number; cost: number }>(),
};
(global as any).__SKIP_TRACE_METRICS__ = skipMetrics;

function recordMetrics(provider: string, success: boolean, cost: number) {
  skipMetrics.traces++;
  skipMetrics.cost += cost || 0;
  if (!skipMetrics.providers.has(provider)) {
    skipMetrics.providers.set(provider, { hits: 0, traces: 0, cost: 0 });
  }
  const p = skipMetrics.providers.get(provider)!;
  p.traces++;
  p.cost += cost || 0;
  if (success) {
    skipMetrics.hits++;
    p.hits++;
  }
}

function mapLeadContactsFromRow(row: any) {
  const phones: Array<{ value: string; type?: string; confidence: number; dnc?: boolean; lastSeen?: string; source?: string }> = [];
  const emails: Array<{ value: string; confidence: number; dnc?: boolean; lastSeen?: string; source?: string }> = [];

  // Attempt to parse JSON fields; fallback to scalar fields if present
  const phonesJson = row?.phonesJson || row?.phones_json;
  const emailsJson = row?.emailsJson || row?.emails_json;

  try {
    if (phonesJson) {
      const arr = typeof phonesJson === 'string' ? JSON.parse(phonesJson) : phonesJson;
      if (Array.isArray(arr)) {
        for (const p of arr) {
          const v = p?.phone_number || p?.value || p;
          if (v) phones.push({ value: String(v), type: p?.phone_type, confidence: typeof p?.confidence === 'number' ? p.confidence : 0.7, dnc: !!p?.dnc_flag, lastSeen: p?.last_seen, source: p?.source || 'batchdata' });
        }
      }
    }
  } catch {}

  try {
    if (emailsJson) {
      const arr = typeof emailsJson === 'string' ? JSON.parse(emailsJson) : emailsJson;
      if (Array.isArray(arr)) {
        for (const e of arr) {
          const v = e?.email || e?.value || e;
          if (v) emails.push({ value: String(v), confidence: typeof e?.confidence === 'number' ? e.confidence : 0.6, dnc: !!e?.dnc_flag, lastSeen: e?.last_seen, source: e?.source || 'batchdata' });
        }
      }
    }
  } catch {}

  // If empty, try best scalar fields
  if (!phones.length && (row?.ownerPhone || row?.phone)) {
    phones.push({ value: String(row.ownerPhone || row.phone), confidence: 0.7, source: 'db' });
  }
  if (!emails.length && (row?.ownerEmail || row?.email)) {
    emails.push({ value: String(row.ownerEmail || row.email), confidence: 0.6, source: 'db' });
  }

  return { phones, emails };
}

function toFEResult(leadId: string, provider: string, quietHours: boolean, serviceResult: any, existingRow?: any): SkipTraceResultFE {
  // serviceResult may contain { success, ownerPhone, emailsJson, phonesJson, cost, dncFlag }
  const contacts = existingRow ? mapLeadContactsFromRow(existingRow) : { phones: [] as any[], emails: [] as any[] };

  // If service result has JSON payloads, merge them
  try {
    const pj = serviceResult?.phonesJson;
    if (pj) {
      const arr = typeof pj === 'string' ? JSON.parse(pj) : pj;
      for (const p of Array.isArray(arr) ? arr : []) {
        const v = p?.phone_number || p?.value || p;
        if (v) contacts.phones.push({ value: String(v), type: p?.phone_type, confidence: typeof p?.confidence === 'number' ? p.confidence : 0.7, dnc: !!p?.dnc_flag, lastSeen: p?.last_seen, source: p?.source || 'batchdata' });
      }
    }
  } catch {}
  try {
    const ej = serviceResult?.emailsJson;
    if (ej) {
      const arr = typeof ej === 'string' ? JSON.parse(ej) : ej;
      for (const e of Array.isArray(arr) ? arr : []) {
        const v = e?.email || e?.value || e;
        if (v) contacts.emails.push({ value: String(v), confidence: typeof e?.confidence === 'number' ? e.confidence : 0.6, dnc: !!e?.dnc_flag, lastSeen: e?.last_seen, source: e?.source || 'batchdata' });
      }
    }
  } catch {}

  if (!contacts.phones.length && serviceResult?.ownerPhone) {
    contacts.phones.push({ value: String(serviceResult.ownerPhone), confidence: 0.7, source: provider });
  }
  if (!contacts.emails.length && serviceResult?.ownerEmail) {
    contacts.emails.push({ value: String(serviceResult.ownerEmail), confidence: 0.6, source: provider });
  }

  return {
    leadId,
    providersTried: [provider],
    cost: typeof serviceResult?.cost === 'number' ? serviceResult.cost : 0,
    contacts,
    compliance: {
      quietHours: !!quietHours,
      dncSuppressed: 0,
    },
  };
}

const router = Router();

/**
 * POST /api/skip-trace
 * Supports two payload styles:
 * 1) { leadId, respectQuietHours, ... }
 * 2) { address, city, state, zipCode, firstName?, lastName? }
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const respectQuietHours = !!body.respectQuietHours;
    // Style 1: by leadId
    if (body.leadId) {
      const leadId = String(body.leadId);
      const lead: any = await (prisma as any).lead.findUnique({ where: { id: leadId } });
      if (!lead) return res.status(404).json({ error: 'lead_not_found' });

      const reqObj: SkipTraceServiceRequest = { address: lead.propertyAddress || lead.address || '', city: lead.city || '', state: lead.state || '', zipCode: lead.zipCode || lead.zip || '' };
      const serviceResult = await batchSkipTraceService.skipTraceByAddress(reqObj);
      recordMetrics('batchdata', !!serviceResult?.success, serviceResult?.cost || 0);
      const payload = toFEResult(leadId, 'batchdata', respectQuietHours, serviceResult, lead);
      return res.status(serviceResult?.success ? 201 : 200).json(payload);
    }

    // Style 2: by address payload
    const reqObj: SkipTraceServiceRequest = {
      address: String(body.address || ''),
      city: String(body.city || ''),
      state: String(body.state || ''),
      zipCode: String(body.zipCode || body.zip || ''),
      firstName: body.firstName ? String(body.firstName) : undefined,
      lastName: body.lastName ? String(body.lastName) : undefined,
    };
    if (!reqObj.address || !reqObj.city || !reqObj.state || !reqObj.zipCode) {
      return res.status(400).json({ error: 'invalid_payload', required: ['address','city','state','zipCode'] });
    }
    const normalized = normalizeAddress(`${reqObj.address}, ${reqObj.city}, ${reqObj.state} ${reqObj.zipCode}`);
    // Try to resolve to an existing lead to attach leadId
    const existingLead: any = await (prisma as any).lead.findFirst({ where: { normalizedAddress: normalized } }).catch(() => null);
    const serviceResult = await batchSkipTraceService.skipTraceByAddress(reqObj);
    recordMetrics('batchdata', !!serviceResult?.success, serviceResult?.cost || 0);
    const payload = toFEResult(existingLead?.id || 'unknown', 'batchdata', respectQuietHours, serviceResult, existingLead || null);
    return res.status(serviceResult?.success ? 201 : 200).json(payload);
  } catch (e: any) {
    return res.status(500).json({ error: 'skip_trace_failed', message: e?.message });
  }
});
 
/**
 * POST /api/skip-trace/bulk
 * Supports payload styles:
 * 1) { leadIds: string[], respectQuietHours }
 * 2) { leads: Array<{ id?: string, address, city, state, zipCode }> }
 */
router.post('/bulk', async (req, res) => {
  try {
    const body = req.body || {};
    const respectQuietHours = !!body.respectQuietHours;
 
    let requests: SkipTraceServiceRequest[] = [];
    let leadIds: string[] = [];
 
    if (Array.isArray(body.leadIds) && body.leadIds.length) {
      leadIds = body.leadIds.map((x: any) => String(x));
      const rows: any[] = await (prisma as any).lead.findMany({ where: { id: { in: leadIds } } }).catch(() => []);
      for (const r of rows) {
        requests.push({ address: r.propertyAddress || r.address || '', city: r.city || '', state: r.state || '', zipCode: r.zipCode || r.zip || '' });
      }
    } else if (Array.isArray(body.leads) && body.leads.length) {
      for (const l of body.leads) {
        requests.push({ address: String(l.address || ''), city: String(l.city || ''), state: String(l.state || ''), zipCode: String(l.zipCode || l.zip || '') });
        if (l.id) leadIds.push(String(l.id));
      }
    } else {
      return res.status(400).json({ error: 'invalid_payload', example: { leadIds: ['id1','id2'] } });
    }
 
    const results = await batchSkipTraceService.batchSkipTrace(requests);
    let hits = 0; let cost = 0;
    const out: BulkSkipTraceResultFE['results'] = [];
 
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const leadId = leadIds[i] || 'unknown';
      const status: 'success' | 'no_hit' | 'suppressed' | 'error' = r?.success ? 'success' : 'no_hit';
      if (r?.success) hits++;
      cost += r?.cost || 0;
      recordMetrics('batchdata', !!r?.success, r?.cost || 0);
      out.push({ leadId, status, matches: r?.success ? 1 : 0, cost: r?.cost || 0 });
    }
 
    const response: BulkSkipTraceResultFE = {
      summary: {
        requested: requests.length,
        processed: results.length,
        hits,
        noHits: results.length - hits,
        suppressed: 0,
        cost,
      },
      results: out,
    };
 
    return res.status(201).json(response);
  } catch (e: any) {
    return res.status(500).json({ error: 'bulk_skip_trace_failed', message: e?.message });
  }
});
 
/**
 * POST /api/skip-trace/:leadId
 * For hooks calling POST with params path.
 */
router.post('/:leadId', async (req, res) => {
  try {
    const leadId = String(req.params.leadId);
    const body = req.body || {};
    const respectQuietHours = !!body.respectQuietHours;
 
    const lead: any = await (prisma as any).lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'lead_not_found' });
 
    const reqObj: SkipTraceServiceRequest = { address: lead.propertyAddress || lead.address || '', city: lead.city || '', state: lead.state || '', zipCode: lead.zipCode || lead.zip || '' };
    const serviceResult = await batchSkipTraceService.skipTraceByAddress(reqObj);
    recordMetrics('batchdata', !!serviceResult?.success, serviceResult?.cost || 0);
    const payload = toFEResult(leadId, 'batchdata', respectQuietHours, serviceResult, lead);
    return res.status(serviceResult?.success ? 201 : 200).json(payload);
  } catch (e: any) {
    return res.status(500).json({ error: 'skip_trace_failed', message: e?.message });
  }
});
 
/**
 * GET /api/skip-trace/:leadId
 * Return the best-known contacts for a lead from DB.
 */
router.get('/:leadId', async (req, res) => {
  try {
    const leadId = String(req.params.leadId);
    const lead: any = await (prisma as any).lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'not_found' });
 
    const contacts = mapLeadContactsFromRow(lead);
    const payload: SkipTraceResultFE = {
      leadId,
      providersTried: ['db'],
      cost: typeof lead?.skipTraceCostCents === 'number' ? lead.skipTraceCostCents : 0,
      contacts,
      compliance: { quietHours: false },
    };
    return res.json(payload);
  } catch (e: any) {
    return res.status(500).json({ error: 'skip_trace_lookup_failed', message: e?.message });
  }
});

/**
 * GET /api/skip-trace/metrics?range=30d or ?period=month
 * Provide basic aggregate metrics.
 */
router.get('/metrics', async (req, res) => {
  try {
    const byProvider: Array<{ name: string; hitRate: number; avgCost: number }> = [];
    for (const [name, v] of skipMetrics.providers.entries()) {
      const hitRate = v.traces ? v.hits / v.traces : 0;
      const avgCost = v.traces ? v.cost / v.traces : 0;
      byProvider.push({ name, hitRate, avgCost });
    }
    const traces = skipMetrics.traces;
    const hitRate = traces ? skipMetrics.hits / traces : 0;
    const cost = skipMetrics.cost;
    const cpcl = skipMetrics.hits ? cost / skipMetrics.hits : 0;

    const payload = { traces, hitRate, cost, cpcl, byProvider };
    return res.json(payload);
  } catch (e: any) {
    return res.status(500).json({ error: 'skip_trace_metrics_failed', message: e?.message });
  }
});

export default router;

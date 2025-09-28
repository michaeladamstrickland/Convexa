import express, { Router } from 'express';
import { prisma } from '../db/prisma';
import { analyzeCallTranscript } from '../services/callAnalysisService';
import { enqueueWebhookDelivery } from '../queues/webhookQueue';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

// In-memory metrics for calls
export const callMetrics = ((global as any).__CALL_METRICS__ = (global as any).__CALL_METRICS__ || {
  started: 0,
  completed: 0,
  transcriptionLatencyMs: [] as number[],
  scoringLatencyMs: [] as number[],
  summary: { success: 0, fail: 0 },
  connectedCalls: 0, // New metric for PI3
  intentsDetected: 0, // New metric for PI3
  agentLatencyMs: [] as number[], // New metric for PI3 (histogram)
  blockedCalls: 0, // New metric for PI3
});

// Live transcript/summary counters
export const callLiveMetrics = ((global as any).__CALL_LIVE_METRICS__ = (global as any).__CALL_LIVE_METRICS__ || {
  transcriptTotal: 0,
  summaryTotal: 0,
});

const router = Router();

// POST /api/calls/start - register a started call (Twilio webhook-compatible subset)
router.post('/start', async (req, res) => {
  try {
    const { callSid, leadId, userId, audioUrl } = req.body || {};
    if (!callSid) return res.status(400).json({ error: 'missing_callSid' });
    await (prisma as any).callTranscript.upsert({
      where: { callSid },
      update: { leadId, userId, audioUrl },
      create: { callSid, leadId, userId, audioUrl },
    });
    callMetrics.started++;
    // Optional event for observability
    return res.status(201).json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'call_start_failed', message: e?.message });
  }
});

// POST /api/calls/complete - mark call completed (store recording url)
router.post('/complete', async (req, res) => {
  try {
    const { callSid, audioUrl } = req.body || {};
    if (!callSid) return res.status(400).json({ error: 'missing_callSid' });
    await (prisma as any).callTranscript.update({ where: { callSid }, data: { audioUrl } }).catch(async () => {
      await (prisma as any).callTranscript.create({ data: { callSid, audioUrl } });
    });
    callMetrics.completed++;
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'call_complete_failed', message: e?.message });
  }
});

// POST /api/calls/transcript - submit transcript text (from Whisper/AssemblyAI)
router.post('/transcript', async (req, res) => {
  const started = Date.now();
  try {
    const body = req.body || {};
    // Accept multiple vendor payloads (AssemblyAI, manual)
    const callSid = body.callSid || body.call_sid || body?.metadata?.callSid || body?.metadata?.call_sid;
    let transcript: string | undefined = body.transcript || body.text || body.transcript_text;
    if (!transcript && Array.isArray(body.utterances)) {
      transcript = (body.utterances as any[]).map(u => u.text).join(' ');
    }
    // Redact PII from the transcript
    if (transcript) {
      const { redactPII } = require('../utils/piiRedactor');
      transcript = redactPII(transcript);
    }
    const leadId = body.leadId || body?.metadata?.leadId;
    const userId = body.userId || body?.metadata?.userId;
    const audioUrl = body.audioUrl || body.audio_url;
    const transcriptUrl = body.transcriptUrl || body.transcript_url;
    const recordingUrl = body.recordingUrl || body.recording_url;
    const dtmfCaptured = body.dtmfCaptured || body.dtmf;
    if (!callSid || !transcript) return res.status(400).json({ error: 'missing_fields', required: ['callSid','transcript'] });
    let row = await (prisma as any).callTranscript.findUnique({ where: { callSid } });
    if (!row) {
      row = await (prisma as any).callTranscript.create({ data: { callSid, transcript, leadId, userId, audioUrl, transcriptUrl, recordingUrl, dtmfCaptured } });
    } else {
      row = await (prisma as any).callTranscript.update({ where: { callSid }, data: { transcript, leadId: row.leadId || leadId, userId: row.userId || userId, audioUrl: row.audioUrl || audioUrl, transcriptUrl: row.transcriptUrl || transcriptUrl, recordingUrl: row.recordingUrl || recordingUrl, dtmfCaptured: row.dtmfCaptured || dtmfCaptured } });
    }
    callMetrics.transcriptionLatencyMs.push(Date.now() - started);
    return res.status(201).json({ success: true, data: row });
  } catch (e: any) {
    return res.status(500).json({ error: 'transcript_store_failed', message: e?.message });
  }
});

// POST /api/calls/analyze - run LLM analysis on existing transcript and create CRM activity call.summary
router.post('/analyze', async (req, res) => {
  const started = Date.now();
  let analysisDetail: any = null;
  try {
  const { callSid, force, transcript } = req.body || {};
    // Allow direct analysis when transcript is provided without callSid (no DB dependency)
    if (!callSid && transcript) {
      try {
        const analysis = await analyzeCallTranscript(String(transcript));
        analysisDetail = analysis;
        callMetrics.scoringLatencyMs.push(Date.now() - started);
        return res.status(201).json({ success: true, analysis_detail: analysis });
      } catch (e: any) {
        callMetrics.summary.fail++;
        callMetrics.scoringLatencyMs.push(Date.now() - started);
        return res.status(500).json({ error: 'call_analyze_failed', message: e?.message });
      }
    }
    if (!callSid) return res.status(400).json({ error: 'missing_callSid' });
    const ct: any = await (prisma as any).callTranscript.findUnique({ where: { callSid } });
    if (!ct || !ct.transcript) return res.status(400).json({ error: 'transcript_not_found' });

    // Run analysis
    let summary = '';
    let score = 0;
    let tags: string[] = [];
    try {
      const analysis = await analyzeCallTranscript(ct.transcript);
      analysisDetail = analysis;
      summary = analysis.summary;
      score = typeof analysis.motivationScore === 'number' ? analysis.motivationScore : 0;
      const t: string[] = [];
      if (analysis.outcome) t.push(`outcome:${analysis.outcome}`);
      if (analysis.sentiment) t.push(`sentiment:${analysis.sentiment}`);
      tags = t;
      callMetrics.summary.success++;
    } catch (err) {
      callMetrics.summary.fail++;
      throw err;
    } finally {
      callMetrics.scoringLatencyMs.push(Date.now() - started);
    }

    // Persist analysis
    let ca: any;
    try {
      ca = await (prisma as any).callAnalysis.upsert({
        where: { callSid },
        update: { summary, score, tags },
        create: { callSid, transcriptId: ct.id, summary, score, tags },
      });
    } catch (e: any) {
      console.error('[calls.analyze] callAnalysis.upsert failed', e?.message || e);
      throw e;
    }

    // Idempotency: ensure only one call.summary activity per callSid unless forced
    let existingActivity: any = null;
    if (!force) {
      try {
        // Portable fallback: fetch recent call.summary activities and filter by metadata.callSid
        const recent: any[] = await (prisma as any).crmActivity.findMany({
          where: { type: 'call.summary' },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        for (const r of recent) {
          if ((r?.metadata as any)?.callSid === callSid) { existingActivity = r; break; }
        }
      } catch {}
    }
    // Create CRM activity and emit webhook if not existing or forced
    let activity: any = existingActivity;
    if (!existingActivity || force) {
      try {
        activity = await (prisma as any).crmActivity.create({
          data: {
            type: 'call.summary',
            leadId: ct.leadId,
            userId: ct.userId,
            metadata: {
              callSid,
              summary,
              score,
              tags,
              transcriptUrl: ct.transcriptUrl || null,
              recordingUrl: ct.recordingUrl || ct.audioUrl || null,
            },
          },
        });
      } catch (e: any) {
        console.error('[calls.analyze] crmActivity.create failed', e?.message || e);
        throw e;
      }
    }
    try {
      const subs: any[] = await (prisma as any).webhookSubscription.findMany({ where: { isActive: true } }).catch(() => []);
      const interested = subs.filter(s => Array.isArray(s.eventTypes) && s.eventTypes.includes('crm.activity'));
      if (interested.length && (!existingActivity || force)) {
        const payload = { id: activity.id, type: activity.type, leadId: activity.leadId, userId: activity.userId, metadata: activity.metadata, createdAt: activity.createdAt };
        await Promise.all(interested.map(s => enqueueWebhookDelivery({ subscriptionId: s.id, eventType: 'crm.activity', payload })));
        const cm = ((global as any).__CRM_ACTIVITY_METRICS__ = (global as any).__CRM_ACTIVITY_METRICS__ || { total: 0, perType: new Map<string, number>(), webhook: { success: 0, fail: 0 } });
        cm.webhook.success += interested.length;
      }
    } catch {
      const cm = ((global as any).__CRM_ACTIVITY_METRICS__ = (global as any).__CRM_ACTIVITY_METRICS__ || { total: 0, perType: new Map<string, number>(), webhook: { success: 0, fail: 0 } });
      cm.webhook.fail++;
    }
    // Increment CRM metrics perType only on first emit (or force)
    const cm = ((global as any).__CRM_ACTIVITY_METRICS__ = (global as any).__CRM_ACTIVITY_METRICS__ || { total: 0, perType: new Map<string, number>(), webhook: { success: 0, fail: 0 } });
    if (!(cm as any).perType || !((cm as any).perType instanceof Map)) {
      try { (cm as any).perType = new Map<string, number>(Object.entries((cm as any).perType || {})); } catch { (cm as any).perType = new Map<string, number>(); }
    }
    if (!existingActivity || force) {
      cm.total++;
      const current = (cm as any).perType.get('call.summary') || 0;
      (cm as any).perType.set('call.summary', current + 1);
    }

    return res.status(201).json({ success: true, analysis: ca, analysis_detail: analysisDetail });
  } catch (e: any) {
  try { console.error('[calls.analyze] error', e?.message || e); } catch {}
  return res.status(500).json({ error: 'call_analyze_failed', message: e?.message });
  }
});

export default router;

// --- Sprint 8: Webhook ingestion for AssemblyAI/Twilio ---

// Capture raw body for signature verification on AssemblyAI webhook
const assemblyAiRouter = Router();
// Use a dedicated JSON parser with raw body capture
assemblyAiRouter.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));

function verifyAssemblyAISignature(req: any): boolean {
  const required = String(process.env.CALL_WEBHOOK_VERIFY || '').toLowerCase() === 'assemblyai';
  if (!required) return true;
  const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
  if (!secret) return true; // disabled if no secret
  try {
    const sigHeader = req.get('X-AssemblyAI-Signature') || req.get('X-Signature') || '';
    if (!sigHeader) return false;
    const crypto = require('crypto');
    const body = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const h = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const expected = `sha256=${h}`;
    return sigHeader === expected || sigHeader === h;
  } catch {
    return false;
  }
}

async function createLiveTranscriptActivity(data: { callSid: string; content: string; speaker?: string; tags?: string[]; score?: number }) {
  try {
    await (prisma as any).crmActivity.create({
      data: {
        type: 'call.live.transcript',
        metadata: {
          callSid: data.callSid,
          content: data.content,
          speaker: data.speaker || null,
          tags: data.tags || [],
          score: typeof data.score === 'number' ? data.score : null,
        },
      },
    });
    callLiveMetrics.transcriptTotal++;
  } catch {}
}

async function createLiveSummaryActivity(data: { callSid: string; summary: string; score?: number; tags?: string[] }) {
  try {
    await (prisma as any).crmActivity.create({
      data: {
        type: 'call.live.summary',
        metadata: {
          callSid: data.callSid,
          summary: data.summary,
          score: typeof data.score === 'number' ? data.score : null,
          tags: data.tags || [],
        },
      },
    });
    callLiveMetrics.summaryTotal++;
  } catch {}
}

// POST /api/calls/webhooks/assemblyai
assemblyAiRouter.post('/webhooks/assemblyai', async (req, res) => {
  const verified = verifyAssemblyAISignature(req);
  if (!verified) return res.status(403).json({ error: 'signature_invalid' });
  try {
    const b = req.body || {};
    const callSid = b.callSid || b.call_sid || b?.metadata?.callSid || b.id || b.audio_url || 'unknown';
    // Normalize transcript + URLs
    const transcriptText: string | undefined = b.transcript || b.text || b.transcript_text;
    const utterances: any[] = Array.isArray(b.utterances) ? b.utterances : [];
    const audioUrl = b.audio_url || b.audioUrl;
    const transcriptUrl = b.transcript_url || b.transcriptUrl;
    const status = b.status || b.event;

    // Upsert transcript row minimally
    await (prisma as any).callTranscript.upsert({
      where: { callSid },
      update: { transcript: transcriptText || undefined, audioUrl: audioUrl || undefined, transcriptUrl: transcriptUrl || undefined },
      create: { callSid, transcript: transcriptText || undefined, audioUrl: audioUrl || undefined, transcriptUrl: transcriptUrl || undefined },
    });

    // Emit live transcript activities per utterance batch
    if (utterances.length) {
      const lines = utterances.map(u => ({ speaker: u?.speaker || u?.speaker_label, text: u?.text || '' }));
      const combined = lines.map(l => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join('\n');
      await createLiveTranscriptActivity({ callSid, content: combined });
    } else if (transcriptText) {
      await createLiveTranscriptActivity({ callSid, content: String(transcriptText) });
    }

    // If transcript completed, auto-run analysis and push live summary
    if (String(status || '').toLowerCase() === 'completed') {
      // fetch the transcript
      const ct: any = await (prisma as any).callTranscript.findUnique({ where: { callSid } });
      if (ct?.transcript) {
        try {
          const analysis = await analyzeCallTranscript(ct.transcript);
          // Persist standard analysis + crm activity call.summary (idempotent)
          // Reuse existing /analyze path logic by invoking directly
          const summary = analysis.summary;
          const score = typeof analysis.motivationScore === 'number' ? analysis.motivationScore : 0;
          const tags: string[] = [];
          if (analysis.outcome) tags.push(`outcome:${analysis.outcome}`);
          if (analysis.sentiment) tags.push(`sentiment:${analysis.sentiment}`);
          await (prisma as any).callAnalysis.upsert({ where: { callSid }, update: { summary, score, tags }, create: { callSid, transcriptId: ct.id, summary, score, tags } });
          // Also push a live.summary activity
          await createLiveSummaryActivity({ callSid, summary, score, tags });
        } catch {}
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'assemblyai_ingest_failed', message: e?.message });
  }
});

// Twilio webhook endpoint (form-encoded). Signature verification is optional; placeholder only.
const twilioRouter = Router();
twilioRouter.use(express.urlencoded({ extended: true }));

function verifyTwilio(_req: any): boolean {
  // Placeholder: real Twilio verification requires full URL and auth token hashing.
  // Respect env toggle; if disabled or missing token, skip verification.
  const required = String(process.env.CALL_WEBHOOK_VERIFY || '').toLowerCase() === 'twilio';
  if (!required) return true;
  return !!process.env.TWILIO_AUTH_TOKEN; // non-zero token considered pass in this stub
}

// POST /twilio/voice/answer - Handles incoming calls and provides TwiML instructions
twilioRouter.post('/twilio/voice/answer', async (req, res) => {
  if (!verifyTwilio(req)) return res.status(403).json({ error: 'signature_invalid' });
  try {
    const twiml = new VoiceResponse();
    twiml.say('Hello from Convexa AI. Please wait while we connect you.');
    twiml.record({
      transcribe: true,
      transcribeCallback: '/twilio/recording-complete',
      maxLength: 3600, // 1 hour max recording
      timeout: 10,
      playBeep: true,
    });
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  } catch (e: any) {
    console.error('[twilio/voice/answer] error', e?.message || e);
    res.status(500).json({ error: 'twilio_voice_answer_failed', message: e?.message });
  }
});

// POST /twilio/voice/status - Handles call status updates
twilioRouter.post('/twilio/voice/status', async (req, res) => {
  if (!verifyTwilio(req)) return res.status(403).json({ error: 'signature_invalid' });
  try {
    const b = req.body || {};
    const callSid = b.CallSid;
    const callStatus = b.CallStatus;
    console.log(`[twilio/voice/status] Call ${callSid} status: ${callStatus}`);
    // Here you might update a database record for the call status
    // For now, just acknowledge
    res.json({ success: true });
  } catch (e: any) {
    console.error('[twilio/voice/status] error', e?.message || e);
    res.status(500).json({ error: 'twilio_voice_status_failed', message: e?.message });
  }
});

// POST /twilio/recording-complete - Handles recording completion
twilioRouter.post('/twilio/recording-complete', async (req, res) => {
  if (!verifyTwilio(req)) return res.status(403).json({ error: 'signature_invalid' });
  try {
    const b = req.body || {};
    const callSid = b.CallSid;
    const recordingUrl = b.RecordingUrl;
    const transcriptText = b.TranscriptionText; // Twilio can transcribe recordings
    if (!callSid) return res.status(400).json({ error: 'missing_callSid' });

    await (prisma as any).callTranscript.upsert({
      where: { callSid },
      update: { recordingUrl: recordingUrl || undefined, transcript: transcriptText || undefined },
      create: { callSid, recordingUrl: recordingUrl || undefined, transcript: transcriptText || undefined },
    });

    if (transcriptText) {
      await createLiveTranscriptActivity({ callSid, content: `Twilio Transcription: ${transcriptText}` });
      // Optionally trigger analysis if a full transcript is available
      // This would be similar to the AssemblyAI webhook logic
      try {
        const analysis = await analyzeCallTranscript(transcriptText);
        const summary = analysis.summary;
        const score = typeof analysis.motivationScore === 'number' ? analysis.motivationScore : 0;
        const tags: string[] = [];
        if (analysis.outcome) tags.push(`outcome:${analysis.outcome}`);
        if (analysis.sentiment) tags.push(`sentiment:${analysis.sentiment}`);
        await (prisma as any).callAnalysis.upsert({ where: { callSid }, update: { summary, score, tags }, create: { callSid, transcriptId: (await (prisma as any).callTranscript.findUnique({ where: { callSid } }))?.id, summary, score, tags } });
        await createLiveSummaryActivity({ callSid, summary, score, tags });
      } catch (analysisError) {
        console.error('[twilio/recording-complete] Analysis failed:', analysisError);
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error('[twilio/recording-complete] error', e?.message || e);
    res.status(500).json({ error: 'twilio_recording_complete_failed', message: e?.message });
  }
});

// Mount webhook sub-routers onto the main router path
router.use(assemblyAiRouter);
router.use(twilioRouter);

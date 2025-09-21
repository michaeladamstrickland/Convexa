/**
 * Call Analysis Service (Production-grade with graceful fallback)
 *
 * Responsibilities:
 * - Analyze a call transcript using OpenAI Chat Completions (if OPENAI_API_KEY is set).
 * - Return a stable DTO consumed by /api/calls/analyze and downstream UI:
 *     {
 *       summary: string;
 *       key_intent: string;
 *       objections: string[];
 *       next_steps: string[];
 *       motivationScore?: number;   // backward-compat
 *       outcome?: 'interested' | 'not_interested' | 'follow_up' | 'unknown'; // backward-compat
 *       sentiment?: 'positive' | 'neutral' | 'negative'; // backward-compat
 *       tags?: string[];            // backward-compat
 *       analysis_status: 'ok' | 'failed';
 *     }
 *
 * - If LLM call fails or no key is configured, return analysis_status='failed' with a
 *   deterministic heuristic result. Never throw to caller.
 *
 * Environment:
 * - OPENAI_API_KEY: required for live LLM analysis
 * - OPENAI_MODEL:   optional, defaults to 'gpt-4o-mini'
 * - OPENAI_API_BASE: optional base URL (default https://api.openai.com/v1)
 */

export type CallAnalysisResult = {
  summary: string;
  key_intent: string;
  objections: string[];
  next_steps: string[];
  motivationScore?: number;
  outcome?: 'interested' | 'not_interested' | 'follow_up' | 'unknown';
  sentiment?: 'positive' | 'neutral' | 'negative';
  tags?: string[];
  analysis_status: 'ok' | 'failed';
};

type ModelResponse = Partial<CallAnalysisResult>;

/**
 * Public API used by routes: analyze a transcript and return a structured result.
 */
export async function analyzeCallTranscript(transcript: string): Promise<CallAnalysisResult> {
  const text = String(transcript || '').trim();

  // Short-circuit if no content
  if (!text) {
    return {
      summary: 'No transcript text provided.',
      key_intent: 'unknown',
      objections: [],
      next_steps: [],
      motivationScore: 0,
      outcome: 'unknown',
      sentiment: 'neutral',
      tags: ['empty_transcript'],
      analysis_status: 'failed'
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseUrl = (process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/+$/,'');

  // Attempt LLM path when key is present
  if (apiKey) {
    try {
      const payload = buildChatPayload(model, text);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Soft fail to heuristic
        return heuristicAnalysis(text, { reason: `openai_http_${res.status}` });
      }

      const data = await res.json();

      // Defensive parsing of assistant content as JSON
      const content = extractAssistantContent(data);
      const parsed = safeParseJson(content);

      // Validate and coerce to our DTO
      const normalized = coerceToResult(parsed);

      // Add best-effort backward-compat fields if missing
      backfillCompat(normalized, text);

      normalized.analysis_status = 'ok';
      return normalized;
    } catch (e: any) {
      return heuristicAnalysis(text, { reason: 'openai_exception', error: e?.message });
    }
  }

  // Fallback if no key
  return heuristicAnalysis(text, { reason: 'no_openai_key' });
}

/* ----------------------- Internal helpers ----------------------- */

function buildChatPayload(model: string, transcript: string) {
  const system = `
You are a sales call analysis engine for real estate acquisitions. 
Output ONLY a compact JSON object with the following EXACT keys:
{
  "summary": string,
  "key_intent": string,               // e.g. "interested", "not_interested", "follow_up", "info_request", "voicemail", etc.
  "objections": string[],             // list of key objections or blockers mentioned by the seller
  "next_steps": string[]              // concrete, actionable follow-ups (e.g., "Schedule walkthrough", "Send offer via email")
}
Do not include any extra commentary or fields. Keep summary to 1-3 sentences.`;

  const user = `
Transcript:
"""
${transcript}
"""

Return JSON only.`;

  // Use a deterministic temperature to keep outputs stable
  return {
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
}

/**
 * Extracts the assistant message content from the OpenAI chat response.
 */
function extractAssistantContent(data: any): string {
  try {
    return String(
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.message ??
      ''
    );
  } catch {
    return '';
  }
}

/**
 * Safe JSON parse. Returns null if it fails.
 */
function safeParseJson(s: string): any | null {
  try {
    if (!s || typeof s !== 'string') return null;
    return JSON.parse(s);
  } catch {
    // Some providers may wrap JSON in backticks or include extra text; attempt to extract JSON object
    const m = s.match(/\{[\s\S]*\}$/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    return null;
  }
}

/**
 * Coerce arbitrary parsed JSON into our ModelResponse shape.
 */
function coerceToResult(parsed: any): CallAnalysisResult {
  const res: CallAnalysisResult = {
    summary: isNonEmptyString(parsed?.summary) ? String(parsed.summary) : 'Summary not available.',
    key_intent: isNonEmptyString(parsed?.key_intent) ? String(parsed.key_intent) : 'unknown',
    objections: Array.isArray(parsed?.objections) ? parsed.objections.map(String) : [],
    next_steps: Array.isArray(parsed?.next_steps) ? parsed.next_steps.map(String) : [],
    // defaults for compat fields; may be backfilled below
    motivationScore: undefined,
    outcome: undefined,
    sentiment: undefined,
    tags: [],
    analysis_status: 'ok'
  };
  return res;
}

function isNonEmptyString(v: any): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Add backward-compatible fields using lightweight heuristics when missing.
 */
function backfillCompat(out: CallAnalysisResult, transcript: string) {
  const t = transcript.toLowerCase();

  // Sentiment/outcome heuristic
  let sentiment: CallAnalysisResult['sentiment'] = 'neutral';
  let outcome: CallAnalysisResult['outcome'] = 'unknown';
  let motivation = 50;
  const tags: string[] = out.tags ? [...out.tags] : [];

  if (t.includes('not interested') || t.includes('stop calling') || t.includes('do not call')) {
    sentiment = 'negative';
    outcome = 'not_interested';
    motivation = 20;
    tags.push('intent:not_interested');
  }
  if (t.includes('follow up') || t.includes('call me back') || t.includes('email me')) {
    outcome = outcome === 'unknown' ? 'follow_up' : outcome;
    tags.push('action:follow_up');
  }
  if (t.includes('interested') || t.includes('offer') || t.includes('price')) {
    sentiment = sentiment === 'negative' ? sentiment : 'positive';
    if (outcome === 'unknown') outcome = 'interested';
    motivation = Math.max(motivation, 70);
    tags.push('intent:interested');
  }

  out.sentiment = out.sentiment || sentiment;
  out.outcome = out.outcome || outcome;
  out.motivationScore = typeof out.motivationScore === 'number' ? out.motivationScore : motivation;
  out.tags = Array.isArray(out.tags) ? Array.from(new Set([...out.tags, ...tags])) : tags;
}

/**
 * Heuristic fallback when OpenAI is unavailable or fails.
 */
function heuristicAnalysis(transcript: string, meta?: { reason?: string; error?: string }): CallAnalysisResult {
  const t = String(transcript || '').toLowerCase();
  let summary = 'Summary: Caller discussed property.';
  let key_intent = 'unknown';
  const objections: string[] = [];
  const next_steps: string[] = [];

  if (t.includes('not interested')) {
    key_intent = 'not_interested';
    objections.push('Seller not interested');
  } else if (t.includes('follow up') || t.includes('call me back') || t.includes('email me')) {
    key_intent = 'follow_up';
    next_steps.push('Schedule follow-up call');
  } else if (t.includes('offer') || t.includes('price')) {
    key_intent = 'interested';
    next_steps.push('Prepare and send offer');
  } else if (t.includes('voicemail')) {
    key_intent = 'voicemail';
    next_steps.push('Leave voicemail and send SMS follow-up');
  }

  // Basic sentiment/motivation/outcome
  let sentiment: CallAnalysisResult['sentiment'] = 'neutral';
  let outcome: CallAnalysisResult['outcome'] = 'unknown';
  let motivation = 50;
  const tags: string[] = [];

  if (key_intent === 'not_interested') {
    sentiment = 'negative'; outcome = 'not_interested'; motivation = 20; tags.push('intent:not_interested');
    summary = 'Summary: Seller is not interested.';
  } else if (key_intent === 'follow_up') {
    outcome = 'follow_up'; motivation = 55; tags.push('action:follow_up');
    summary = 'Summary: Seller requested follow-up.';
  } else if (key_intent === 'interested') {
    sentiment = 'positive'; outcome = 'interested'; motivation = 70; tags.push('intent:interested');
    summary = 'Summary: Seller showed interest and discussed pricing.';
  }

  return {
    summary,
    key_intent,
    objections,
    next_steps,
    motivationScore: motivation,
    outcome,
    sentiment,
    tags,
    analysis_status: 'failed'
  };
}

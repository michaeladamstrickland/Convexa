import OpenAI from 'openai';

export interface CallAnalysisResult {
  summary: string;
  motivationScore: number;
  outcome?: string;
  sentiment?: string;
}

function fallbackHeuristic(transcript: string): CallAnalysisResult {
  const lower = (transcript || '').toLowerCase();
  const positiveHints = ['interested', 'yes', 'ready', 'offer', 'cash', 'close quickly'];
  const negativeHints = ['not interested', 'no', 'stop', 'remove', 'do not', 'hang up'];
  let score = 0.5;
  if (positiveHints.some(w => lower.includes(w))) score += 0.3;
  if (negativeHints.some(w => lower.includes(w))) score -= 0.4;
  score = Math.max(0, Math.min(1, score));
  return {
    summary: transcript.slice(0, 280),
    motivationScore: score,
    outcome: score > 0.7 ? 'hot' : score > 0.5 ? 'warm' : 'cold',
    sentiment: score > 0.6 ? 'positive' : score < 0.4 ? 'negative' : 'neutral',
  };
}

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    return new OpenAI({ apiKey: key });
  } catch {
    return null;
  }
}

// Minimal analysis wrapper; falls back to heuristic summary if key missing
export async function analyzeCallTranscript(transcript: string): Promise<CallAnalysisResult> {
  const client = getClient();
  if (!client) {
    // Heuristic fallback for local/dev
    return fallbackHeuristic(transcript);
  }
  try {
    const prompt = `Summarize this sales call for a real estate acquisition. Return a JSON object with keys: summary (string), motivationScore (0-1 float), outcome (one of hot|warm|cold), sentiment (positive|neutral|negative). Keep it concise.

TRANSCRIPT:\n${transcript}\n`;
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert sales call analyst for real estate acquisitions. Output JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    });
    const text = resp.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(text);
      return {
        summary: parsed.summary || text.slice(0, 280),
        motivationScore: typeof parsed.motivationScore === 'number' ? parsed.motivationScore : 0,
        outcome: parsed.outcome,
        sentiment: parsed.sentiment,
      };
    } catch {
      return { summary: text.slice(0, 280), motivationScore: 0.5 };
    }
  } catch {
    // Network or API error -> fallback
    return fallbackHeuristic(transcript);
  }
}

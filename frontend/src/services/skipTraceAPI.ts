// API types for skip tracing
export interface SkipTraceResult {
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
}

export interface SkipTraceOptions {
  respectQuietHours: boolean;
  force?: boolean;
}

export interface BulkSkipTraceResult {
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
}

export interface SkipTraceMetrics {
  traces: number;
  hitRate: number;
  cost: number;
  cpcl: number;
  byProvider: Array<{
    name: string;
    hitRate: number;
    avgCost: number;
  }>;
}

// Skip trace API functions
export async function skipTraceLead(
  leadId: string,
  opts: SkipTraceOptions
): Promise<SkipTraceResult> {
  const res = await fetch(`/api/skip-trace/${leadId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function bulkSkipTrace(
  leadIds: string[],
  opts: { respectQuietHours: boolean }
): Promise<BulkSkipTraceResult> {
  const res = await fetch(`/api/skip-trace/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadIds, ...opts }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSkipTraceMetrics(range = "30d"): Promise<SkipTraceMetrics> {
  const res = await fetch(`/api/skip-trace/metrics?range=${range}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

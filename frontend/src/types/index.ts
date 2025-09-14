// Types for leads
export interface Lead {
  id: string;
  propertyAddress?: string;
  ownerName?: string;
  traceStatus?: 'Untraced' | 'Partial' | 'Completed' | 'No-Hit';
  bestPhone?: string;
  bestEmail?: string;
  phoneConfidence?: number;
}

// Types for skip trace status and chips
export type TraceStatusChip = 'Untraced' | 'Partial' | 'Completed' | 'No-Hit';

export type BulkTraceStatus = 'success' | 'no_hit' | 'suppressed' | 'error' | 'queued' | 'running';

// Types for contact components
export interface Contact {
  value: string;
  type?: string;
  confidence: number;
  dnc?: boolean;
  lastSeen?: string;
  source?: string;
  isPrimary?: boolean;
}

export interface ContactAction {
  label: string;
  onClick: () => void;
}

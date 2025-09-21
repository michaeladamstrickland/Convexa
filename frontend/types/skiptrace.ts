// Shared types for skip trace flows

export interface Lead {
  id: string;
  address?: string;
  name?: string;
  [key: string]: any;
}

export interface SkipTraceContact {
  type: 'phone' | 'email' | 'address';
  value: string;
  score?: number;
  label?: string;
}

export interface SkipTraceResult {
  leadId: string;
  contacts: SkipTraceContact[];
  costCents?: number;
  provider?: string;
  createdAt?: string;
}

export interface BulkSkipTraceResult {
  results: SkipTraceResult[];
  totalCostCents?: number;
}

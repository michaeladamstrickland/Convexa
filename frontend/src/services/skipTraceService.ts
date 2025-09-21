import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Lead, 
  SkipTraceResult, 
  BulkSkipTraceResult 
} from '../../types/skiptrace';

// Base API URL
const API_BASE_URL = '/api';

// Skip trace a single lead
export async function skipTraceLead(leadData: Lead): Promise<SkipTraceResult> {
  const response = await fetch(`${API_BASE_URL}/skip-trace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(leadData),
  });

  if (!response.ok) {
    throw new Error(`Failed to skip trace lead: ${response.statusText}`);
  }

  return await response.json();
}

// Skip trace multiple leads in bulk
export async function skipTraceLeadsBulk(leadsData: Lead[]): Promise<BulkSkipTraceResult> {
  const response = await fetch(`${API_BASE_URL}/skip-trace/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ leads: leadsData }),
  });

  if (!response.ok) {
    throw new Error(`Failed to bulk skip trace leads: ${response.statusText}`);
  }

  return await response.json();
}

// Get skip trace results for a specific lead
export async function getLeadSkipTraceResults(leadId: string): Promise<SkipTraceResult | null> {
  const response = await fetch(`${API_BASE_URL}/skip-trace/${leadId}`);
  
  if (response.status === 404) {
    return null; // No skip trace results for this lead
  }
  
  if (!response.ok) {
    throw new Error(`Failed to get skip trace results: ${response.statusText}`);
  }

  return await response.json();
}

// Get skip trace metrics
export async function getSkipTraceMetrics(period: 'day' | 'week' | 'month' | 'year' = 'month') {
  const response = await fetch(`${API_BASE_URL}/skip-trace/metrics?period=${period}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get skip trace metrics: ${response.statusText}`);
  }

  return await response.json();
}

// React Query hooks

// Hook to skip trace a single lead
export function useSkipTraceLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: skipTraceLead,
    onSuccess: (data) => {
      if (data?.leadId) {
        qc.invalidateQueries({ queryKey: ['leadContacts', data.leadId] });
        qc.invalidateQueries({ queryKey: ['leads'] });
      }
    },
  });
}

// Hook to skip trace multiple leads
export function useSkipTraceLeadsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: skipTraceLeadsBulk,
    onSuccess: (res) => {
      const ids = res?.results?.map(r => r.leadId).filter(Boolean) as string[];
      ids.forEach((id) => qc.invalidateQueries({ queryKey: ['leadContacts', id] }));
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

// Hook to get skip trace results for a lead
export function useLeadSkipTraceResults(leadId: string) {
  return useQuery({
    queryKey: ['skipTraceResults', leadId],
    queryFn: () => getLeadSkipTraceResults(leadId),
    // Skip query if leadId is not provided
    enabled: !!leadId,
  });
}

// Hook to get skip trace metrics
export function useSkipTraceMetrics(period: 'day' | 'week' | 'month' | 'year' = 'month') {
  return useQuery({
    queryKey: ['skipTraceMetrics', period],
    queryFn: () => getSkipTraceMetrics(period),
  });
}

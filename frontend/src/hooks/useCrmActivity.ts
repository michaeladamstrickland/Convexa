import { useQuery } from "@tanstack/react-query";
import api from "../api/client";

export type CrmActivityType =
  | "note"
  | "enrichment.completed"
  | "call.summary"
  | "call.live.transcript"
  | "call.live.summary"
  | string;

export interface CrmActivity {
  id: string;
  leadId?: string;
  type: CrmActivityType;
  createdAt: string;
  data?: any;
}

async function fetchCrmActivity(leadId: string): Promise<CrmActivity[]> {
  const res = await api.get(`/admin/crm-activity`, { params: { leadId } });
  // Support both {success,data} and raw array responses
  const payload = res.data;
  if (Array.isArray(payload)) return payload as CrmActivity[];
  if (Array.isArray(payload?.data)) return payload.data as CrmActivity[];
  if (Array.isArray(payload?.activities)) return payload.activities as CrmActivity[];
  return [];
}

export function useCrmActivity(leadId?: string) {
  return useQuery({
    queryKey: ["crmActivity", leadId],
    queryFn: () => fetchCrmActivity(leadId!),
    enabled: !!leadId,
  });
}

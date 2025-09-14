import { useQuery } from "@tanstack/react-query";
import { leadsApi, Lead, LeadFilters, PaginatedResponse } from "../api/leads";

export interface UseLeadsOptions extends LeadFilters {}

export function useLeads(options: UseLeadsOptions = {}) {
  return useQuery<PaginatedResponse<Lead>>({
    queryKey: ["leads", options],
    queryFn: () => leadsApi.getLeads(options),
  });
}

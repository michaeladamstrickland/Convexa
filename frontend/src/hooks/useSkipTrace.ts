import { useMutation, useQueryClient } from "@tanstack/react-query";
import { skipTraceLead, bulkSkipTrace } from "../services/skipTraceAPI";

export function useSkipTrace(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { respectQuietHours: boolean; force?: boolean }) => skipTraceLead(leadId, opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leadContacts", leadId] });
      qc.invalidateQueries({ queryKey: ["crmActivity", leadId] });
    },
  });
}

export function useBulkSkipTrace(leadIds: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { respectQuietHours: boolean }) => bulkSkipTrace(leadIds, opts),
    onSuccess: () => {
      leadIds.forEach((id) => qc.invalidateQueries({ queryKey: ["leadContacts", id] }));
      leadIds.forEach((id) => qc.invalidateQueries({ queryKey: ["crmActivity", id] }));
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

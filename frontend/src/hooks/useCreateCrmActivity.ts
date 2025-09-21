import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCrmActivity, CreateCrmActivityInput } from '../api/crm';

export function useCreateCrmActivity(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CreateCrmActivityInput, 'leadId'>) =>
      createCrmActivity({ ...payload, leadId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crmActivity', leadId] });
    },
  });
}

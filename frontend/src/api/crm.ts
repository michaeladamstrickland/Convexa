import api from './client';

export async function getCrmActivity(params: { leadId?: string; type?: string }) {
  const res = await api.get('/admin/crm-activity', { params });
  return res.data;
}

export interface CreateCrmActivityInput {
  leadId: string;
  type: string; // e.g., "note", "call.manual"
  data?: any;
}

export async function createCrmActivity(payload: CreateCrmActivityInput) {
  const res = await api.post('/admin/crm-activity', payload);
  return res.data;
}

import api from './client';

export interface Lead {
  id: string;
  propertyAddress: string;
  city: string;
  state: string;
  zipCode: string;
  ownerName?: string;
  phoneNumber?: string;
  email?: string;
  listPrice?: number;
  arv?: number;
  estimatedRepairs?: number;
  equity?: number;
  equityPercent?: number;
  motivationScore?: number;
  dealScore?: number;
  dealPotential?: 'flip' | 'wholesale' | 'rental' | 'pass';
  status: 'new' | 'contacted' | 'interested' | 'not_interested' | 'closed';
  priority: 'low' | 'medium' | 'high';
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFilters {
  status?: string;
  source?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface LeadStats {
  total: number;
  newLeads: number;
  contacted: number;
  interested: number;
  closed: number;
  averageScore: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    leads: T[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export const leadsApi = {
  getLeads: async (filters?: LeadFilters): Promise<PaginatedResponse<Lead>> => {
    const response = await api.get('/leads', { params: filters });
    return response.data;
  },

  getLead: async (id: string): Promise<{ success: boolean; data: Lead }> => {
    const response = await api.get(`/leads/${id}`);
    return response.data;
  },

  createLead: async (data: Partial<Lead>): Promise<{ success: boolean; data: Lead }> => {
    const response = await api.post('/leads', data);
    return response.data;
  },

  updateLead: async (id: string, data: Partial<Lead>): Promise<{ success: boolean; data: Lead }> => {
    const response = await api.patch(`/leads/${id}`, data);
    return response.data;
  },

  deleteLead: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/leads/${id}`);
    return response.data;
  },

  getStats: async (): Promise<{ success: boolean; data: LeadStats }> => {
    const response = await api.get('/leads/stats');
    return response.data;
  },

  runSkipTrace: async (id: string): Promise<{ success: boolean; data: any }> => {
    const response = await api.post(`/leads/${id}/skip-trace`);
    return response.data;
  },

  generateCallScript: async (id: string): Promise<{ success: boolean; data: { script: string } }> => {
    const response = await api.get(`/leads/${id}/call-script`);
    return response.data;
  },
};

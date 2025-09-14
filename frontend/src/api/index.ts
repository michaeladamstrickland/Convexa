import api from './client'

// Types
export interface Lead {
  id: string
  propertyAddress: string
  city: string
  state: string
  zipCode: string
  listPrice?: number
  estimatedValue?: number
  equity?: number
  equityPercent?: number
  ownerName?: string
  phoneNumbers?: string[]
  email?: string
  isAbsenteeOwner?: boolean
  status: string
  priority: string
  source: string
  aiScore?: number
  dealPotential?: string
  motivationScore?: number
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  organizationId: string
}

export interface AuthResponse {
  success: boolean
  token: string
  data: {
    user: User
  }
}

export interface LeadsResponse {
  success: boolean
  data: {
    leads: Lead[]
    pagination: {
      total: number
      page: number
      limit: number
      totalPages: number
    }
  }
}

// Auth API
export const authAPI = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password })
    return response.data
  },
  
  register: async (userData: {
    firstName: string
    lastName: string
    email: string
    password: string
    organizationName: string
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', userData)
    return response.data
  },
}

// Leads API
export const leadsAPI = {
  getLeads: async (params: {
    page?: number
    limit?: number
    status?: string
    search?: string
  } = {}): Promise<LeadsResponse> => {
    const response = await api.get('/leads', { params })
    return response.data
  },
  
  getLead: async (id: string): Promise<{ success: boolean; data: Lead }> => {
    const response = await api.get(`/leads/${id}`)
    return response.data
  },
  
  createLead: async (leadData: Partial<Lead>): Promise<{ success: boolean; data: Lead }> => {
    const response = await api.post('/leads', leadData)
    return response.data
  },
  
  updateLead: async (id: string, leadData: Partial<Lead>): Promise<{ success: boolean; data: Lead }> => {
    const response = await api.patch(`/leads/${id}`, leadData)
    return response.data
  },
  
  runSkipTrace: async (id: string): Promise<{ success: boolean; data: any }> => {
    const response = await api.post(`/leads/${id}/skip-trace`)
    return response.data
  },
  
  generateCallScript: async (id: string): Promise<{ success: boolean; data: { script: string } }> => {
    const response = await api.get(`/leads/${id}/call-script`)
    return response.data
  },
  
  getLeadStats: async (): Promise<{ success: boolean; data: any }> => {
    const response = await api.get('/leads/stats')
    return response.data
  },
}

// Scraper API
export const scraperAPI = {
  runZillowScraper: async (data: {
    zipCodes: string[]
    maxPages: number
  }): Promise<{ success: boolean; data: any }> => {
    const response = await api.post('/scraper/zillow', data)
    return response.data
  },
}

export default api

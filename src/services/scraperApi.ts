import axios from 'axios';

// Default headers to include in all requests
const defaultHeaders = {
  'Content-Type': 'application/json',
};

// Create authenticated API client instance
const createAuthenticatedClient = () => {
  // Initialize the client with defaults
  const client = axios.create({
    baseURL: '/api',
    headers: defaultHeaders,
    timeout: 30000, // 30 seconds timeout
  });

  // Request interceptor to add authentication headers
  client.interceptors.request.use(
    (config) => {
      // Get token from localStorage
      const token = localStorage.getItem('authToken');
      
      // If token exists, add it to the headers
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for handling authentication errors
  client.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      // Handle authentication errors
      if (error.response && error.response.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return client;
};

// Export a singleton instance of the authenticated client
export const authApi = createAuthenticatedClient();

// API endpoints for scraper functionality
export const scraperApi = {
  // Job management
  startScraper: (source: string, config: any) => 
    authApi.post(`/scraper/${source}`, { ...config }),
  
  getJobs: (params: { limit?: number; page?: number; status?: string; source?: string }) => 
    authApi.get('/scraper/jobs', { params }),
  
  getJobById: (jobId: string) => 
    authApi.get(`/scraper/jobs/${jobId}`),
  
  processRecords: (jobId: string) => 
    authApi.post('/scraper/process-records', { jobId }),
  
  // Schedule management
  getSchedules: () => 
    authApi.get('/scheduler/schedules'),
  
  createSchedule: (data: { name: string; scraperType: string; cronExpression: string; config: any }) => 
    authApi.post('/scheduler/schedules', data),
  
  updateSchedule: (scheduleId: string, data: { name?: string; cronExpression?: string; config?: any; isActive?: boolean }) => 
    authApi.put(`/scheduler/schedules/${scheduleId}`, data),
  
  deleteSchedule: (scheduleId: string) => 
    authApi.delete(`/scheduler/schedules/${scheduleId}`),
  
  runSchedule: (scheduleId: string) => 
    authApi.post(`/scheduler/schedules/${scheduleId}/run`),
  
  // Property records
  getPropertyRecords: (params: { limit?: number; page?: number; processed?: boolean; source?: string; jobId?: string }) => 
    authApi.get('/scraper/property-records', { params }),
};

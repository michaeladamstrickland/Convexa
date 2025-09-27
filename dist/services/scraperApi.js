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
    client.interceptors.request.use((config) => {
        // Get token from localStorage
        const token = localStorage.getItem('authToken');
        // If token exists, add it to the headers
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    }, (error) => {
        return Promise.reject(error);
    });
    // Response interceptor for handling authentication errors
    client.interceptors.response.use((response) => {
        return response;
    }, (error) => {
        // Handle authentication errors
        if (error.response && error.response.status === 401) {
            // Clear token and redirect to login
            localStorage.removeItem('authToken');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    });
    return client;
};
// Export a singleton instance of the authenticated client
export const authApi = createAuthenticatedClient();
// API endpoints for scraper functionality
export const scraperApi = {
    // Job management
    startScraper: (source, config) => authApi.post(`/scraper/${source}`, { ...config }),
    getJobs: (params) => authApi.get('/scraper/jobs', { params }),
    getJobById: (jobId) => authApi.get(`/scraper/jobs/${jobId}`),
    processRecords: (jobId) => authApi.post('/scraper/process-records', { jobId }),
    // Schedule management
    getSchedules: () => authApi.get('/scheduler/schedules'),
    createSchedule: (data) => authApi.post('/scheduler/schedules', data),
    updateSchedule: (scheduleId, data) => authApi.put(`/scheduler/schedules/${scheduleId}`, data),
    deleteSchedule: (scheduleId) => authApi.delete(`/scheduler/schedules/${scheduleId}`),
    runSchedule: (scheduleId) => authApi.post(`/scheduler/schedules/${scheduleId}/run`),
    // Property records
    getPropertyRecords: (params) => authApi.get('/scraper/property-records', { params }),
};
//# sourceMappingURL=scraperApi.js.map
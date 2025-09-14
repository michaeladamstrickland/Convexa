"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scraperApi = exports.authApi = void 0;
const axios_1 = __importDefault(require("axios"));
// Default headers to include in all requests
const defaultHeaders = {
    'Content-Type': 'application/json',
};
// Create authenticated API client instance
const createAuthenticatedClient = () => {
    // Initialize the client with defaults
    const client = axios_1.default.create({
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
exports.authApi = createAuthenticatedClient();
// API endpoints for scraper functionality
exports.scraperApi = {
    // Job management
    startScraper: (source, config) => exports.authApi.post(`/scraper/${source}`, { ...config }),
    getJobs: (params) => exports.authApi.get('/scraper/jobs', { params }),
    getJobById: (jobId) => exports.authApi.get(`/scraper/jobs/${jobId}`),
    processRecords: (jobId) => exports.authApi.post('/scraper/process-records', { jobId }),
    // Schedule management
    getSchedules: () => exports.authApi.get('/scheduler/schedules'),
    createSchedule: (data) => exports.authApi.post('/scheduler/schedules', data),
    updateSchedule: (scheduleId, data) => exports.authApi.put(`/scheduler/schedules/${scheduleId}`, data),
    deleteSchedule: (scheduleId) => exports.authApi.delete(`/scheduler/schedules/${scheduleId}`),
    runSchedule: (scheduleId) => exports.authApi.post(`/scheduler/schedules/${scheduleId}/run`),
    // Property records
    getPropertyRecords: (params) => exports.authApi.get('/scraper/property-records', { params }),
};
//# sourceMappingURL=scraperApi.js.map
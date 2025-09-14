import axios from 'axios';

// Read API base from Vite env; default to backend dev port 3001
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
  const token = localStorage.getItem('leadflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login on unauthorized
      localStorage.removeItem('leadflow_token');
      localStorage.removeItem('leadflow_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

import axios from 'axios';

/**
 * Global Axios API Client Instance configured for future Express/Node Backend Integration.
 * 
 * ENVIRONMENT VARIABLE:
 * VITE_API_BASE_URL defaults to http://localhost:5000/api
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer Token if available in localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mplads_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Global response parsing & error handling
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[apiClient] Unauthorized session detected.');
    }
    return Promise.reject(error);
  }
);

export default apiClient;

import apiClient from './apiClient';

/**
 * Production Authentication Service Adapter.
 * Currently fallback/commented to indicate future HTTP API endpoint wiring.
 */
export const authService = {
  login: async (credentials) => {
    // Future Real Backend Call:
    // return await apiClient.post('/auth/login', credentials);
    throw new Error('Real authentication backend not connected yet. Use mockAuthService.');
  },

  getCurrentUser: async () => {
    // return await apiClient.get('/auth/me');
    throw new Error('Real authentication backend not connected yet. Use mockAuthService.');
  },

  logout: async () => {
    // return await apiClient.post('/auth/logout');
    localStorage.removeItem('mplads_auth_token');
  }
};

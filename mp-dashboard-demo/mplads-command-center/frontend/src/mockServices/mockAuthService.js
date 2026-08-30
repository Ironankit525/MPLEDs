import { MOCK_USERS } from '../mock/users';
import { MOCK_MPS } from '../mock/mps';

export const mockAuthService = {
  loginWithMP: async (mpId) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const user = MOCK_USERS.find(u => u.mpId === mpId) || MOCK_USERS[0];
    const mp = MOCK_MPS.find(m => m.id === mpId) || MOCK_MPS[0];

    const authPayload = {
      token: `demo_jwt_token_${mp.id}_${Date.now()}`,
      user,
      mp
    };

    localStorage.setItem('mplads_auth_token', authPayload.token);
    localStorage.setItem('mplads_active_mp_id', mp.id);

    return authPayload;
  },

  getCurrentSession: async () => {
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlRole = params.get('role');
    if (urlToken) {
      document.cookie = `auth_token=${urlToken}; path=/`;
      document.cookie = `user_role=${urlRole}; path=/`;
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
    if (!token) return null;
    
    const savedMpId = localStorage.getItem('mplads_active_mp_id') || 'MP001';
    const user = MOCK_USERS.find(u => u.mpId === savedMpId) || MOCK_USERS[0];
    const mp = MOCK_MPS.find(m => m.id === savedMpId) || MOCK_MPS[0];

    return { user, mp };
  },

  logout: async () => {
    document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    localStorage.removeItem('mplads_auth_token');
    localStorage.removeItem('mplads_active_mp_id');
    window.location.href = 'https://inspiring-lebkuchen-67d55f.netlify.app/';
    return true;
  }
};

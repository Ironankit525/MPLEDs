import { MOCK_USERS } from '../mock/users.js';
import { MOCK_MPS } from '../mock/mps.js';

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
    const savedMpId = localStorage.getItem('mplads_active_mp_id') || 'MP001';
    const user = MOCK_USERS.find(u => u.mpId === savedMpId) || MOCK_USERS[0];
    const mp = MOCK_MPS.find(m => m.id === savedMpId) || MOCK_MPS[0];

    return { user, mp };
  },

  logout: async () => {
    localStorage.removeItem('mplads_auth_token');
    localStorage.removeItem('mplads_active_mp_id');
    return true;
  }
};

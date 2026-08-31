// All data in the demo environment is fictional and used only for development/testing.

import { MOCK_MPS } from './mps';

export const MOCK_USERS = MOCK_MPS.map(mp => ({
  id: `USR_${mp.id}`,
  name: mp.name,
  email: mp.email,
  role: mp.role,
  mpId: mp.id,
  mp: mp
}));

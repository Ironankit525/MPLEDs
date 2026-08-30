import { mockRequest } from './mockData'

const TOKEN_STORAGE_KEY = 'mplads_demo_token';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function getToken() {
  return getCookie('auth_token') || localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token) {
  if (token) {
    document.cookie = `auth_token=${token}; path=/; domain=localhost`;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    document.cookie = `auth_token=; path=/; domain=localhost; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Standalone demo data adapter. Replace with a production API client when
// connecting this UI to a real backend.
export async function request(path, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 180))
  try {
    return mockRequest(path, options)
  } catch (error) {
    throw new ApiError(error.message)
  }
}

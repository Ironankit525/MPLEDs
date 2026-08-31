import { mockRequest } from './mockData.js'

const TOKEN_STORAGE_KEY = 'mplads_demo_token';
const REAL_API_BASE = 'http://localhost:8000';

// Routes that should go to the real FastAPI backend
const REAL_API_ROUTES = ['/api/images/submit', '/api/images/mine', '/api/sessions/create'];

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function getToken() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  const urlRole = params.get('role');
  
  if (urlToken) {
    document.cookie = `auth_token=${urlToken}; path=/`;
    document.cookie = `user_role=${urlRole}; path=/`;
    localStorage.setItem(TOKEN_STORAGE_KEY, urlToken);
    window.history.replaceState({}, document.title, window.location.pathname);
    return urlToken;
  }
  return getCookie('auth_token') || localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token) {
  if (token) {
    document.cookie = `auth_token=${token}; path=/`;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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

// Routes image uploads and listings through the real backend;
// everything else uses the local mock data for the demo.
export async function request(path, options = {}) {
  if (REAL_API_ROUTES.some(route => path.startsWith(route))) {
    const { method = 'GET', json, form, urlEncoded } = options
    const headers = {}
    let body

    if (json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(json)
    } else if (form !== undefined) {
      body = form
    } else if (urlEncoded !== undefined) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      body = urlEncoded
    }

    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`

    let res
    try {
      res = await fetch(`${REAL_API_BASE}${path}`, { method, headers, body })
    } catch {
      // Backend not running — fall back to mock so the demo doesn't break
      console.warn(`[client] Backend unreachable for ${path}, falling back to mock data`)
      return mockRequest(path, options)
    }

    if (!res.ok) {
      let message = res.statusText || 'Request failed'
      try {
        const data = await res.json()
        if (typeof data.detail === 'string') message = data.detail
      } catch { /* non-JSON error body */ }
      throw new ApiError(message, res.status)
    }

    if (res.status === 204) return null
    return res.json()
  }

  // Non-image routes use mock data
  await new Promise((resolve) => setTimeout(resolve, 180))
  try {
    return mockRequest(path, options)
  } catch (error) {
    throw new ApiError(error.message)
  }
}


// Low-level API client (Model layer). Talks to the Express backend under /api.
// Adds the JWT from localStorage, unwraps the {success,data,meta} envelope and throws ApiError on failure.

export const TOKEN_KEY = 'lh-token';
export const AUTH_KEY = 'lh-auth-user';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details || null;
  }
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
}
export function setToken(token) {
  try { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
}

function qs(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
}

export async function request(path, { method = 'GET', body, params, raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  const res = await fetch('/api' + path + qs(params), { method, headers, body: payload });
  // A stale or revoked session (e.g. token from an older login system): drop it and go to login.
  if (res.status === 401 && token && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    setToken('');
    try { localStorage.removeItem('lh-auth-user'); } catch (e) { /* ignore */ }
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login?expired=1');
    }
  }
  if (raw) {
    if (!res.ok) throw new ApiError('Request failed (' + res.status + ')', res.status);
    return res;
  }
  let json = null;
  try { json = await res.json(); } catch (e) { json = null; }
  if (!res.ok || !json || json.success === false) {
    const err = (json && json.error) || {};
    throw new ApiError(err.message || (json && json.message) || 'Request failed (' + res.status + ')', res.status, err.details);
  }
  return json; // {success, data, message, meta?, pagination?}
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: path => request(path, { method: 'DELETE' }),
  download: (path, params) => request(path, { params, raw: true })
};

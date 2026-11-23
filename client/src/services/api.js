import axios from 'axios';

const TOKEN_KEY = 'ajaia_token';

// localStorage can throw (private mode, blocked storage); fail soft.
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? '';
    // An expired/invalid session anywhere except the login form ends the session.
    if (error.response?.status === 401 && !url.endsWith('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  },
);

/** Human-readable message for any request failure. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.error) return error.response.data.error;
  if (!error?.response) return 'Cannot reach the server. Check your connection and try again.';
  return fallback;
}

export const api = {
  login: (email, password) => http.post('/auth/login', { email, password }).then((r) => r.data),
  logout: () => http.post('/auth/logout').catch(() => {}),
  me: () => http.get('/auth/me').then((r) => r.data),

  listDocuments: (q) => http.get('/documents', { params: q ? { q } : {} }).then((r) => r.data),
  createDocument: (title) => http.post('/documents', title ? { title } : {}).then((r) => r.data.document),
  getDocument: (id) => http.get(`/documents/${id}`).then((r) => r.data.document),
  updateDocument: (id, changes) => http.put(`/documents/${id}`, changes).then((r) => r.data.document),
  deleteDocument: (id) => http.delete(`/documents/${id}`),

  listShares: (id) => http.get(`/documents/${id}/shares`).then((r) => r.data.shares),
  addShare: (id, email, role) => http.post(`/documents/${id}/shares`, { email, role }).then((r) => r.data.share),
  removeShare: (id, userId) => http.delete(`/documents/${id}/shares/${userId}`),

  uploadFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return http.post('/uploads', form).then((r) => r.data.document);
  },
};

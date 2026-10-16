import axios from 'axios';

// Production build: same origin (the nginx container proxies /api to the backend), so the
// app works from any domain/IP without rebuilding. Dev: the local backend.
// Set VITE_API_BASE_URL only if the API lives on a different domain.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smart_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('smart_token');
      localStorage.removeItem('smart_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;

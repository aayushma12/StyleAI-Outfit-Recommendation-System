import axios from 'axios';

const api = axios.create({
  baseURL:         process.env.REACT_APP_API_URL || '/api',
  timeout:         30000,
  withCredentials: true, // httpOnly cookie is sent automatically on every request
});

// Auth endpoints that should never trigger a session-expired redirect.
// A 401 from these is a normal "wrong credentials / no session" response,
// not an indication of an expired in-flight session.
const AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/logout',
  '/auth/me',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend',
];

const isAuthEndpoint = (url = '') =>
  AUTH_PATHS.some(path => url.includes(path));

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !isAuthEndpoint(err.config?.url)) {
      // Session expired during an active API call (not during a login attempt).
      // Dispatch a custom event so AuthContext can reset its state via React,
      // avoiding a full-page reload / redirect loop.
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
    return Promise.reject(err);
  }
);

export default api;

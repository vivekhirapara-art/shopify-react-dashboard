import axios from 'axios';

/** In dev, use Vite proxy (same origin). Set VITE_API_URL for production. */
const API_BASE =
  import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ''
    ? import.meta.env.VITE_API_URL
    : import.meta.env.DEV
      ? ''
      : 'http://localhost:5000';

/** Primary auth key (per spec) */
export const AUTH_STORAGE_KEY = 'shopify_auth';
const LEGACY_AUTH_KEY = 'shopify_dashboard_auth';
export const STORES_HISTORY_KEY = 'shopify_dashboard_stores_history';

export const CACHE_KEYS = [
  'cached_products',
  'cached_orders',
  'cached_analytics',
  'cached_collections',
  'cached_customers',
  'cached_discounts',
];

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

function normalizeStoreUrlInput(storeUrl) {
  const v = String(storeUrl || '').trim();
  if (!v) return '';
  return v.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function normalizeTokenInput(token) {
  const v = String(token || '').trim();
  return v;
}

export function clearAppCache() {
  CACHE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

export function getStoredAuth() {
  try {
    let raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_AUTH_KEY);
      if (raw) {
        localStorage.setItem(AUTH_STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_AUTH_KEY);
      }
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthHeaders(storeUrl, accessToken) {
  const normalizedStoreUrl = normalizeStoreUrlInput(storeUrl);
  const normalizedToken = normalizeTokenInput(accessToken);
  if (normalizedStoreUrl && normalizedToken) {
    api.defaults.headers.common['X-Store-Url'] = normalizedStoreUrl;
    api.defaults.headers.common['X-Shopify-Token'] = normalizedToken;
  } else {
    delete api.defaults.headers.common['X-Store-Url'];
    delete api.defaults.headers.common['X-Shopify-Token'];
  }
}

export function applyAuthFromStorage() {
  const auth = getStoredAuth();
  if (auth?.storeUrl && auth?.accessToken) {
    setAuthHeaders(auth.storeUrl, auth.accessToken);
  }
  return auth;
}

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  const isAuthVerify = config.url?.includes('/api/auth/verify');
  if (!isAuthVerify) {
    const auth = getStoredAuth();
    const storeUrl = normalizeStoreUrlInput(auth?.storeUrl);
    const token = normalizeTokenInput(auth?.accessToken);
    if (storeUrl && token) {
      config.headers['X-Store-Url'] = storeUrl;
      config.headers['X-Shopify-Token'] = token;
    } else {
      delete config.headers['X-Store-Url'];
      delete config.headers['X-Shopify-Token'];
    }
  }
  config.headers['Cache-Control'] = 'no-cache';
  config.headers['Pragma'] = 'no-cache';
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setAuthHeaders(null, null);
    }
    return Promise.reject(err);
  }
);

applyAuthFromStorage();

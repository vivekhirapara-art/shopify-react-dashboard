import { createContext, useState, useEffect, useCallback } from 'react';
import {
  api,
  AUTH_STORAGE_KEY,
  STORES_HISTORY_KEY,
  getStoredAuth,
  setAuthHeaders,
  clearAppCache,
} from '../utils/api';

export const AuthContext = createContext(null);

function normalizeStoreInput(input) {
  let url = String(input || '').trim().toLowerCase();
  url = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!url) return '';
  if (!url.includes('.')) {
    url = `${url}.myshopify.com`;
  }
  return url;
}

function saveToHistory(credentials) {
  try {
    const history = JSON.parse(localStorage.getItem(STORES_HISTORY_KEY) || '[]');
    const entry = {
      storeUrl: credentials.storeUrl,
      storeName: credentials.storeName,
      accessToken: credentials.accessToken,
      connectedAt: credentials.connectedAt,
    };
    const filtered = history.filter((h) => h.storeUrl !== entry.storeUrl);
    const next = [entry, ...filtered].slice(0, 3);
    localStorage.setItem(STORES_HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function getStoreHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORES_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [storeHistory, setStoreHistory] = useState(getStoreHistory);

  const persistAuth = useCallback((credentials) => {
    clearAppCache();

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        storeUrl: credentials.storeUrl,
        accessToken: credentials.accessToken,
        storeName: credentials.storeName,
        plan: credentials.plan,
        email: credentials.email,
        connectedAt: credentials.connectedAt || new Date().toISOString(),
      })
    );

    setAuthHeaders(credentials.storeUrl, credentials.accessToken);
    setUser(credentials);
    const history = saveToHistory(credentials);
    setStoreHistory(history);
  }, []);

  const verifyAndLogin = useCallback(
    async (storeUrlInput, accessToken, options = {}) => {
      const storeUrl = normalizeStoreInput(storeUrlInput);
      const token = String(accessToken || '').trim();

      if (!storeUrl || !token) {
        throw new Error('Store URL and access token are required');
      }

      const previous = getStoredAuth();
      const isSwitch = Boolean(previous?.storeUrl && previous.storeUrl !== storeUrl);

      if (isSwitch) {
        clearAppCache();
      }

      // Verify without custom headers (avoids CORS preflight issues on login)
      const { data } = await api.post('/api/auth/verify', { storeUrl, accessToken: token });

      if (!data.valid) {
        throw new Error(data.error || 'Invalid credentials');
      }

      const credentials = {
        storeUrl: data.storeUrl || storeUrl,
        accessToken: token,
        storeName: data.storeName || storeUrl.split('.')[0],
        plan: data.plan,
        email: data.email,
        connectedAt: new Date().toISOString(),
      };

      setAuthHeaders(credentials.storeUrl, credentials.accessToken);
      persistAuth(credentials);

      if (isSwitch || options.isSwitch || options.reload) {
        window.location.href = '/';
        return credentials;
      }

      return credentials;
    },
    [persistAuth]
  );

  const logout = useCallback(() => {
    clearAppCache();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('shopify_dashboard_auth');
    setAuthHeaders(null, null);
    setUser(null);
  }, []);

  const isAuthenticated = useCallback(() => Boolean(user?.storeUrl && user?.accessToken), [user]);

  useEffect(() => {
    async function bootstrap() {
      const stored = getStoredAuth();
      if (!stored?.storeUrl || !stored?.accessToken) {
        setIsChecking(false);
        return;
      }

      setAuthHeaders(stored.storeUrl, stored.accessToken);
      try {
        const { data } = await api.post('/api/auth/verify', {
          storeUrl: stored.storeUrl,
          accessToken: stored.accessToken,
        });
        if (data.valid) {
          const credentials = {
            ...stored,
            storeName: data.storeName || stored.storeName,
            plan: data.plan,
            email: data.email,
          };
          persistAuth(credentials);
        } else {
          logout();
        }
      } catch {
        logout();
      } finally {
        setIsChecking(false);
      }
    }
    bootstrap();
  }, [persistAuth, logout]);

  const value = {
    user,
    isChecking,
    isAuthenticated,
    login: verifyAndLogin,
    logout,
    storeHistory,
    setStoreHistory,
    normalizeStoreInput,
    clearAppCache,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

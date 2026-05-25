export {
  api,
  AUTH_STORAGE_KEY,
  STORES_HISTORY_KEY,
  CACHE_KEYS,
  getStoredAuth,
  setAuthHeaders,
  applyAuthFromStorage,
  clearAppCache,
} from '../utils/api';

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
}

export function parseOrdersResponse(data) {
  if (Array.isArray(data)) {
    return { orders: data, syncError: null, needsScope: false };
  }
  return {
    orders: data?.orders ?? [],
    syncError: data?.syncError ?? null,
    needsScope: data?.needsScope ?? false,
  };
}

export function timeAgo(dateString) {
  if (!dateString) return 'Never';
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

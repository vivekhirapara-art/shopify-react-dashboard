export const AUTO_SYNC_KEY = 'settings_auto_sync_5m';
export const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function isAutoSyncEnabled() {
  const stored = localStorage.getItem(AUTO_SYNC_KEY);
  if (stored === null) return true;
  return stored === 'true';
}

export function setAutoSyncEnabled(enabled) {
  localStorage.setItem(AUTO_SYNC_KEY, String(enabled));
  window.dispatchEvent(new Event('auto-sync-changed'));
}

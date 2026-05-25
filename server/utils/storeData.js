const { db } = require('../db');

function normalizeStoreUrl(storeUrl) {
  return String(storeUrl || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function getActiveStoreUrl() {
  const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'active_store_url'").get();
  return row?.value || null;
}

function setActiveStoreUrl(storeUrl) {
  const normalized = normalizeStoreUrl(storeUrl);
  db.prepare(
    `INSERT INTO sync_meta (key, value) VALUES ('active_store_url', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(normalized);
  return normalized;
}

function clearStoreLocalData() {
  db.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM products;
    DELETE FROM notifications;
    DELETE FROM sync_logs;
    DELETE FROM sync_meta WHERE key NOT LIKE 'webhook_last_%' AND key != 'active_store_url';
  `);
}

function ensureStoreContext(storeUrl) {
  if (!storeUrl) return null;

  const normalized = normalizeStoreUrl(storeUrl);
  const active = getActiveStoreUrl();

  if (active && active !== normalized) {
    clearStoreLocalData();
  }

  setActiveStoreUrl(normalized);
  return normalized;
}

module.exports = {
  normalizeStoreUrl,
  getActiveStoreUrl,
  setActiveStoreUrl,
  clearStoreLocalData,
  ensureStoreContext,
};

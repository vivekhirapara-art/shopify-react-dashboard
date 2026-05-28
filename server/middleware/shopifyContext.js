const { AsyncLocalStorage } = require('async_hooks');
const { ensureStoreContext } = require('../utils/storeData');

const storage = new AsyncLocalStorage();

function normalizeStoreUrlInput(storeUrl) {
  return String(storeUrl || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function isProbablyValidStoreUrl(storeUrl) {
  const v = normalizeStoreUrlInput(storeUrl);
  if (!v) return false;
  if (v.includes(' ') || v.includes('undefined') || v.includes('null')) return false;
  // Accept typical Shopify domains (myshopify.com) and custom domains.
  if (!v.includes('.')) return false;
  if (v.length < 4) return false;
  return true;
}

function isProbablyValidToken(token) {
  const v = String(token || '').trim();
  if (!v) return false;
  if (v.includes(' ') || v.includes('undefined') || v.includes('null')) return false;
  return v.length >= 10;
}

function getHeaderCredentials(req) {
  const storeUrlRaw = req.headers['x-store-url'] || '';
  const accessTokenRaw = req.headers['x-shopify-token'] || '';
  const storeUrl = normalizeStoreUrlInput(storeUrlRaw);
  const accessToken = String(accessTokenRaw || '').trim();
  return { storeUrl, accessToken };
}

function getRequestCredentials(req) {
  const fromHeaders = getHeaderCredentials(req);
  if (isProbablyValidStoreUrl(fromHeaders.storeUrl) && isProbablyValidToken(fromHeaders.accessToken)) {
    return fromHeaders;
  }
  return {
    storeUrl: process.env.SHOPIFY_STORE_URL || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
  };
}

function shopifyContextMiddleware(req, res, next) {
  const { storeUrl, accessToken } = getHeaderCredentials(req);

  if (isProbablyValidStoreUrl(storeUrl) && isProbablyValidToken(accessToken)) {
    ensureStoreContext(storeUrl);
  }

  req.shopifyCredentials = getRequestCredentials(req);

  storage.run({ storeUrl, accessToken }, next);
}

function getCredentials() {
  const ctx = storage.getStore();
  if (ctx?.storeUrl && ctx?.accessToken) {
    return {
      storeUrl: ctx.storeUrl,
      accessToken: ctx.accessToken,
    };
  }
  return {
    storeUrl: process.env.SHOPIFY_STORE_URL || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
  };
}

module.exports = {
  shopifyContextMiddleware,
  getCredentials,
  getRequestCredentials,
  getHeaderCredentials,
  storage,
};

const { AsyncLocalStorage } = require('async_hooks');
const { ensureStoreContext } = require('../utils/storeData');

const storage = new AsyncLocalStorage();

function getHeaderCredentials(req) {
  const storeUrl = req.headers['x-store-url'] || '';
  const accessToken = req.headers['x-shopify-token'] || '';
  return { storeUrl, accessToken };
}

function getRequestCredentials(req) {
  const fromHeaders = getHeaderCredentials(req);
  if (fromHeaders.storeUrl && fromHeaders.accessToken) {
    return fromHeaders;
  }
  return {
    storeUrl: process.env.SHOPIFY_STORE_URL || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
  };
}

function shopifyContextMiddleware(req, res, next) {
  const { storeUrl, accessToken } = getHeaderCredentials(req);

  if (storeUrl && accessToken) {
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

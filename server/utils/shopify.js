const axios = require('axios');
const { getCredentials } = require('../middleware/shopifyContext');
const { normalizeProductImageUrl } = require('./productImage');

const API_VERSION = '2024-01';

function normalizeStoreUrl(storeUrl) {
  return String(storeUrl || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function getShopifyConfig(overrides = {}) {
  const creds = getCredentials();
  const storeUrl = normalizeStoreUrl(overrides.storeUrl || creds.storeUrl);
  const accessToken = (overrides.accessToken || creds.accessToken || '').trim();
  const baseUrl = `https://${storeUrl}/admin/api/${API_VERSION}`;

  return {
    baseUrl,
    storeUrl,
    accessToken,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  };
}

async function shopifyRequest(method, endpoint, data = null, overrides = {}) {
  const { baseUrl, headers, storeUrl, accessToken } = getShopifyConfig(overrides);

  if (!storeUrl || !accessToken) {
    const err = new Error('Shopify credentials not configured');
    err.code = 'NO_CREDENTIALS';
    throw err;
  }

  // Some endpoints (like `/admin/oauth/access_scopes.json`) are NOT versioned under `/admin/api/{version}`.
  const isOAuthEndpoint = String(endpoint || '').startsWith('/oauth/');
  const url = isOAuthEndpoint ? `https://${storeUrl}/admin${endpoint}` : `${baseUrl}${endpoint}`;
  const config = { method, url, headers };
  if (data) config.data = data;

  const response = await axios(config);
  return response.data;
}

async function verifyShopifyCredentials(storeUrl, accessToken) {
  return shopifyRequest('GET', '/shop.json', null, { storeUrl, accessToken });
}

function mapShopifyProduct(product) {
  const variant = product.variants?.[0] || {};
  const totalStock = (product.variants || []).reduce(
    (sum, v) => sum + (v.inventory_quantity ?? 0),
    0
  );

  return {
    shopify_id: String(product.id),
    handle: String(product.handle || '').trim(),
    title: product.title,
    description: product.body_html || '',
    price: parseFloat(variant.price || 0),
    stock: totalStock,
    status: product.status || 'active',
    image: normalizeProductImageUrl(product.images?.[0]?.src || null),
    vendor: product.vendor || '',
  };
}

module.exports = {
  shopifyRequest,
  verifyShopifyCredentials,
  mapShopifyProduct,
  normalizeStoreUrl,
  API_VERSION,
};

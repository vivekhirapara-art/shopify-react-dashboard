const express = require('express');
const fs = require('fs');
const path = require('path');
const { verifyShopifyCredentials, normalizeStoreUrl } = require('../utils/shopify');
const { ensureStoreContext } = require('../utils/storeData');

const router = express.Router();

function updateEnvFile(storeUrl, accessToken) {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;

  let content = fs.readFileSync(envPath, 'utf8');
  const setLine = (key, value) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content += `\n${line}`;
    }
  };

  setLine('SHOPIFY_STORE_URL', storeUrl);
  setLine('SHOPIFY_ACCESS_TOKEN', accessToken);
  fs.writeFileSync(envPath, content.trim() + '\n');

  process.env.SHOPIFY_STORE_URL = storeUrl;
  process.env.SHOPIFY_ACCESS_TOKEN = accessToken;
}

router.post('/verify', async (req, res) => {
  try {
    const { storeUrl: rawUrl, accessToken } = req.body;

    if (!rawUrl || !accessToken) {
      return res.status(400).json({ valid: false, error: 'Store URL and access token are required' });
    }

    const storeUrl = normalizeStoreUrl(rawUrl);
    if (!storeUrl.includes('myshopify.com') && !storeUrl.includes('.')) {
      return res.status(400).json({ valid: false, error: 'Invalid store URL format' });
    }

    const data = await verifyShopifyCredentials(storeUrl, accessToken.trim());
    const shop = data.shop;

    try {
      updateEnvFile(storeUrl, accessToken.trim());
    } catch (envErr) {
      console.warn('Could not update .env:', envErr.message);
    }

    const storeName = shop.name || storeUrl.split('.')[0];

    ensureStoreContext(storeUrl);

    res.json({
      valid: true,
      storeName,
      storeUrl,
      plan: shop.plan_display_name || shop.plan_name || 'Shopify',
      email: shop.email || '',
    });
  } catch (err) {
    const message =
      err.response?.data?.errors ||
      err.response?.data?.error ||
      err.message ||
      'Invalid credentials';
    res.status(401).json({
      valid: false,
      error: typeof message === 'string' ? message : 'Invalid credentials',
    });
  }
});

module.exports = router;

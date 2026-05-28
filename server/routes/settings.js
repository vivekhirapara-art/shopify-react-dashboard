const express = require('express');
const { db } = require('../db');
const { shopifyRequest, mapShopifyProduct } = require('../utils/shopify');
const { logSync } = require('../utils/syncLogDb');
const { createNotification } = require('../utils/notificationsDb');

const router = express.Router();

const upsertProduct = db.prepare(`
  INSERT INTO products (shopify_id, handle, title, description, price, stock, status, image, vendor, created_at)
  VALUES (@shopify_id, @handle, @title, @description, @price, @stock, @status, @image, @vendor, datetime('now'))
  ON CONFLICT(shopify_id) DO UPDATE SET
    handle = @handle,
    title = @title,
    description = @description,
    price = @price,
    stock = @stock,
    status = @status,
    image = @image,
    vendor = @vendor
`);

function getMeta(key, fallback = null) {
  const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key);
  return row?.value ?? fallback;
}

function setMeta(key, value) {
  db.prepare(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, typeof value === 'string' ? value : JSON.stringify(value));
}

function getSyncHistory() {
  try {
    return JSON.parse(getMeta('sync_history', '[]')) || [];
  } catch {
    return [];
  }
}

function appendSyncHistory(entry) {
  const history = getSyncHistory();
  history.unshift(entry);
  setMeta('sync_history', JSON.stringify(history.slice(0, 5)));
}

async function timedRequest(method, path, data = null) {
  const start = Date.now();
  try {
    await shopifyRequest(method, path, data);
    return { ok: true, ms: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - start,
      error: err.response?.data?.errors || err.response?.data?.error || err.message,
    };
  }
}

const REQUIRED_SCOPES = [
  'read_orders',
  'write_orders',
  'read_products',
  'write_products',
  'read_inventory',
  'write_inventory',
  'read_price_rules',
  'write_price_rules',
];

/** Fetch scopes granted to the current access token from Shopify. */
async function fetchTokenScopesFromShopify() {
  const start = Date.now();
  const data = await shopifyRequest('GET', '/oauth/access_scopes.json');
  const rows = (data && data.access_scopes) || [];
  const handles = rows.map((row) => row && row.handle).filter(Boolean);
  return {
    tokenScopes: handles,
    tokenScopeSet: new Set(handles),
    checkedAt: new Date().toISOString(),
    ms: Date.now() - start,
  };
}

router.get('/scopes', async (_req, res) => {
  try {
    const { tokenScopes, tokenScopeSet, checkedAt, ms } = await fetchTokenScopesFromShopify();

    const scopeResults = {};
    const missing = [];

    for (const scope of REQUIRED_SCOPES) {
      const ok = tokenScopeSet.has(scope);
      scopeResults[scope] = { ok };
      if (!ok) missing.push(scope);
    }

    res.json({
      allOk: missing.length === 0,
      required: REQUIRED_SCOPES,
      tokenScopes,
      scopes: scopeResults,
      missing,
      checkedAt,
      ms,
    });
  } catch (err) {
    const errMsg =
      (err && err.response && err.response.data && err.response.data.errors) ||
      (err && err.response && err.response.data && err.response.data.error) ||
      err.message;

    console.error('Scopes check failed:', errMsg);

    const scopeResults = {};
    for (const scope of REQUIRED_SCOPES) {
      scopeResults[scope] = { ok: false, error: String(errMsg) };
    }

    res.status(err.response && err.response.status ? err.response.status : 500).json({
      allOk: false,
      required: REQUIRED_SCOPES,
      tokenScopes: [],
      scopes: scopeResults,
      missing: [...REQUIRED_SCOPES],
      error: errMsg,
    });
  }
});

router.post('/test-connection', async (_req, res) => {
  const [products, orders, inventory] = await Promise.all([
    timedRequest('GET', '/products.json?limit=1'),
    timedRequest('GET', '/orders.json?limit=1'),
    timedRequest('GET', '/inventory_items.json?limit=1'),
  ]);

  const testedAt = new Date().toISOString();
  setMeta('last_connection_test', testedAt);

  res.json({
    tested_at: testedAt,
    products,
    orders,
    inventory,
  });
});

router.get('/webhooks-status', (_req, res) => {
  const paths = ['order-created', 'order-updated', 'order-cancelled'];
  const webhooks = paths.map((slug) => ({
    slug,
    last_received: getMeta(`webhook_last_${slug}`, null),
    active: Boolean(getMeta(`webhook_last_${slug}`, null)),
  }));
  res.json({ webhooks });
});

router.get('/sync-history', (_req, res) => {
  res.json({
    last_sync: getMeta('last_sync', null),
    history: getSyncHistory(),
  });
});

router.post('/sync-products', async (req, res) => {
  const syncType = req.body?.type || 'manual';
  const start = Date.now();
  try {
    const existingRows = db.prepare('SELECT shopify_id, title, price, stock, status FROM products').all();
    const existingMap = new Map(existingRows.map((r) => [r.shopify_id, r]));

    const data = await shopifyRequest('GET', '/products.json?limit=250');
    const shopifyProducts = data.products || [];

    let newCount = 0;
    let updatedCount = 0;
    const newTitles = [];
    const lowStock = [];

    const syncTx = db.transaction((products) => {
      for (const product of products) {
        const mapped = mapShopifyProduct(product);
        const prev = existingMap.get(mapped.shopify_id);
        if (!prev) {
          newCount++;
          newTitles.push(mapped.title);
        } else if (
          prev.title !== mapped.title ||
          prev.price !== mapped.price ||
          prev.stock !== mapped.stock ||
          prev.status !== mapped.status
        ) {
          updatedCount++;
        }
        if (mapped.stock > 0 && mapped.stock <= 5) {
          lowStock.push({ title: mapped.title, stock: mapped.stock });
        }
        upsertProduct.run(mapped);
      }
    });

    syncTx(shopifyProducts);

    const now = new Date().toISOString();
    const durationMs = Date.now() - start;
    setMeta('last_sync', now);

    const entry = {
      at: now,
      total: shopifyProducts.length,
      new: newCount,
      updated: updatedCount,
    };
    appendSyncHistory(entry);

    logSync({
      type: syncType,
      status: 'success',
      total: shopifyProducts.length,
      new_count: newCount,
      updated_count: updatedCount,
      duration_ms: durationMs,
      details: {
        new_products: newTitles.slice(0, 10),
        low_stock: lowStock.slice(0, 5),
        api_calls: ['GET /products.json?limit=250'],
      },
    });

    createNotification({
      type: 'system',
      title: 'Sync complete',
      message: `${shopifyProducts.length} products synced — ${newCount} new, ${updatedCount} updated`,
    });

    if (lowStock.length > 0) {
      createNotification({
        type: 'stock',
        title: `Low stock: ${lowStock[0].title}`,
        message: `${lowStock.length} product(s) at or below 5 units`,
      });
    }

    res.json({
      success: true,
      last_sync: now,
      synced: shopifyProducts.length,
      new: newCount,
      updated: updatedCount,
      ...entry,
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const errMsg = err.response?.data?.errors || err.response?.data?.error || err.message;
    logSync({
      type: syncType,
      status: 'failed',
      duration_ms: durationMs,
      error: errMsg,
      details: { api_calls: ['GET /products.json?limit=250'] },
    });
    createNotification({
      type: 'error',
      title: 'Sync failed',
      message: String(errMsg),
    });
    console.error('Sync products error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

router.post('/clear-database', async (_req, res) => {
  try {
    db.exec(`
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM products;
      DELETE FROM sync_meta WHERE key NOT LIKE 'webhook_last_%';
    `);

    const data = await shopifyRequest('GET', '/products.json?limit=250');
    const shopifyProducts = data.products || [];
    const syncTx = db.transaction((products) => {
      for (const product of products) {
        upsertProduct.run(mapShopifyProduct(product));
      }
    });
    syncTx(shopifyProducts);

    const now = new Date().toISOString();
    setMeta('last_sync', now);
    appendSyncHistory({
      at: now,
      total: shopifyProducts.length,
      new: shopifyProducts.length,
      updated: 0,
      cleared: true,
    });

    res.json({
      success: true,
      message: 'Local database cleared and products re-synced from Shopify',
      products_synced: shopifyProducts.length,
      last_sync: now,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/store', async (_req, res) => {
  try {
    const { shop } = await shopifyRequest('GET', '/shop.json');
    res.json({
      name: shop.name,
      domain: shop.domain,
      plan: shop.plan_display_name || shop.plan_name || 'Development Store',
      email: shop.email,
    });
  } catch {
    res.json({
      name: 'testing24v',
      domain: 'testing24v.myshopify.com',
      plan: 'Development Store',
    });
  }
});

module.exports = router;

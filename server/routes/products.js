const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { shopifyRequest, mapShopifyProduct } = require('../utils/shopify');
const { normalizeProductImageUrl } = require('../utils/productImage');
const { getRequestCredentials } = require('../middleware/shopifyContext');

const router = express.Router();

function shopifyCreds(req) {
  return getRequestCredentials(req);
}
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files allowed'));
    }
  },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file && typeof file.mimetype === 'string' && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  },
});

function pickField(row, ...names) {
  for (const name of names) {
    const key = Object.keys(row).find((k) => k.toLowerCase().trim() === name.toLowerCase());
    if (key != null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return undefined;
}

function normalizeCsvRow(row) {
  return {
    shopify_id: pickField(row, 'shopify_id', 'shopify id'),
    title: pickField(row, 'title', 'Title', 'NAME', 'name', 'product'),
    price: pickField(row, 'price', 'Price') || '0',
    stock: pickField(row, 'stock', 'Stock', 'inventory', 'Inventory', 'quantity') || '0',
    vendor: pickField(row, 'vendor', 'Vendor') || '',
    status: pickField(row, 'status', 'Status') || 'active',
    image: pickField(row, 'image', 'Image', 'image_url'),
  };
}

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

function getLocalProducts() {
  return db
    .prepare('SELECT * FROM products ORDER BY created_at DESC')
    .all()
    .map((p) => ({
      ...p,
      image: normalizeProductImageUrl(p.image),
    }));
}

router.get('/', async (req, res) => {
  try {
    const data = await shopifyRequest('GET', '/products.json?limit=250');
    const shopifyProducts = data.products || [];

    const sync = db.transaction((products) => {
      for (const product of products) {
        const mapped = mapShopifyProduct(product);
        const image = product.images?.[0]?.src || null;
        upsertProduct.run({
          ...mapped,
          image: normalizeProductImageUrl(image) || mapped.image,
          handle: mapped.handle || '',
        });
      }
      db.prepare(
        `INSERT INTO sync_meta (key, value) VALUES ('last_sync', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(new Date().toISOString());
    });

    sync(shopifyProducts);
    res.json(getLocalProducts());
  } catch (err) {
    console.error('Products fetch error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json([]);
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, price, stock, status, vendor, image } = req.body;

    const payload = {
      product: {
        title: title || 'New Product',
        status: status || 'active',
        vendor: vendor || '',
        body_html: description || '',
        variants: [
          {
            price: String(price || 0),
            inventory_management: 'shopify',
            inventory_quantity: parseInt(stock, 10) || 0,
          },
        ],
      },
    };

    if (image) {
      payload.product.images = [{ src: image }];
    }

    const data = await shopifyRequest('POST', '/products.json', payload);
    const mapped = mapShopifyProduct(data.product);
    upsertProduct.run({ ...mapped, handle: mapped.handle || '' });

    const product = db
      .prepare('SELECT * FROM products WHERE shopify_id = ?')
      .get(mapped.shopify_id);
    res.status(201).json(product);
  } catch (err) {
    console.error('Create product error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.errors || err.message });
  }
});

router.get('/export-csv', (req, res) => {
  const products = getLocalProducts();
  const fields = ['id', 'shopify_id', 'handle', 'title', 'price', 'stock', 'status', 'vendor', 'image'];
  const parser = new Parser({ fields });
  const csvData = parser.parse(products);

  res.header('Content-Type', 'text/csv');
  res.attachment('products.csv');
  res.send(csvData);
});

function handleCsvUpload(req, res, next) {
  upload.single('csv')(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) {
      return upload.single('file')(req, res, next);
    }
    return next();
  });
}

router.post('/import-csv', handleCsvUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file required (field name: csv)' });
  }

  const creds = shopifyCreds(req);
  if (!creds.storeUrl || !creds.accessToken) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(401).json({ error: 'Shopify credentials not configured' });
  }

  const results = [];
  const errors = [];
  const rows = [];

  const processRow = async (rawRow) => {
    const row = normalizeCsvRow(rawRow);
    if (!row.title || row.title.toLowerCase() === 'title') {
      return;
    }

    try {
      const shopifyId = row.shopify_id;
      if (shopifyId) {
        const local = db.prepare('SELECT * FROM products WHERE shopify_id = ?').get(shopifyId);
        const shopifyData = await shopifyRequest('GET', `/products/${shopifyId}.json`, null, creds);
        const variantId = shopifyData.product.variants?.[0]?.id;
        if (!variantId) {
          throw new Error(`No variant found for product ${shopifyId}`);
        }
        await shopifyRequest(
          'PUT',
          `/products/${shopifyId}.json`,
          {
            product: {
              id: parseInt(shopifyId, 10),
              title: row.title,
              status: row.status,
              vendor: row.vendor,
              variants: [
                {
                  id: variantId,
                  price: String(row.price),
                  inventory_quantity: parseInt(row.stock, 10) || 0,
                },
              ],
            },
          },
          creds
        );
        upsertProduct.run({
          shopify_id: shopifyId,
          handle: shopifyData.product.handle || local?.handle || '',
          title: row.title,
          price: parseFloat(row.price) || 0,
          stock: parseInt(row.stock, 10) || 0,
          status: row.status,
          image: row.image || local?.image || null,
          vendor: row.vendor,
        });
        results.push(shopifyId);
        return;
      }

      const payload = {
        product: {
          title: row.title,
          status: row.status,
          vendor: row.vendor,
          variants: [
            {
              price: String(row.price),
              inventory_management: 'shopify',
              inventory_quantity: parseInt(row.stock, 10) || 0,
            },
          ],
        },
      };
      if (row.image) {
        payload.product.images = [{ src: row.image }];
      }

      const data = await shopifyRequest('POST', '/products.json', payload, creds);
      const created = mapShopifyProduct(data.product);
      upsertProduct.run({ ...created, handle: created.handle || '' });
      results.push(String(data.product.id));
    } catch (err) {
      console.error('CSV row error:', err.response?.data || err.message);
      errors.push({ title: row.title, error: err.response?.data?.errors || err.message });
    }
  };

  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => rows.push(row))
    .on('end', async () => {
      try {
        for (let i = 0; i < rows.length; i += 1) {
          await processRow(rows[i]);
        }
        res.json({ success: true, imported: results.length, total: rows.length, errors });
      } catch (err) {
        console.error('CSV import end error:', err);
        res.status(500).json({ error: err.message });
      } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    })
    .on('error', (err) => {
      console.error('CSV stream error:', err);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).json({ error: err.message });
    });
});

router.get('/:id', async (req, res) => {
  try {
    const local = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!local) return res.status(404).json({ error: 'Product not found' });

    try {
      const shopifyData = await shopifyRequest('GET', `/products/${local.shopify_id}.json`);
      const mapped = mapShopifyProduct(shopifyData.product);
      upsertProduct.run({ ...mapped, handle: mapped.handle || '' });
      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
      const images = Array.isArray(shopifyData.product.images)
        ? shopifyData.product.images.map((img) => ({
            id: img && img.id ? String(img.id) : undefined,
            src: normalizeProductImageUrl(img && img.src),
          }))
        : [];
      return res.json({ ...updated, images });
    } catch {
      return res.json({ ...local, images: [] });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/images', imageUpload.array('images', 10), async (req, res) => {
  try {
    const local = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!local) return res.status(404).json({ error: 'Product not found' });

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: 'No images received' });

    for (const file of files) {
      const attachment = file.buffer.toString('base64');
      await shopifyRequest('POST', `/products/${local.shopify_id}/images.json`, {
        image: {
          attachment,
          filename: file.originalname || 'image.png',
        },
      });
    }

    const shopifyData = await shopifyRequest('GET', `/products/${local.shopify_id}.json`);
    const mapped = mapShopifyProduct(shopifyData.product);
    upsertProduct.run({ ...mapped, handle: mapped.handle || '' });
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    const images = Array.isArray(shopifyData.product.images)
      ? shopifyData.product.images.map((img) => ({
          id: img && img.id ? String(img.id) : undefined,
          src: normalizeProductImageUrl(img && img.src),
        }))
      : [];

    return res.json({ ...updated, images });
  } catch (err) {
    return res.status(500).json({ error: err.response?.data?.errors || err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const local = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!local) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { title, description, price, stock, status, vendor, image } = req.body;

    const shopifyData = await shopifyRequest(
      'GET',
      `/products/${local.shopify_id}.json`
    );
    const shopifyProduct = shopifyData.product;
    const variantId = shopifyProduct.variants?.[0]?.id;

    const updatePayload = {
      product: {
        id: parseInt(local.shopify_id, 10),
        title: title ?? local.title,
        status: status ?? local.status,
        vendor: vendor ?? local.vendor,
        body_html: description ?? local.description ?? '',
        variants: [
          {
            id: variantId,
            price: String(price ?? local.price),
            inventory_quantity: parseInt(stock ?? local.stock, 10),
          },
        ],
      },
    };

    if (image) {
      updatePayload.product.images = [{ src: image }];
    }

    const data = await shopifyRequest(
      'PUT',
      `/products/${local.shopify_id}.json`,
      updatePayload
    );
    const mapped = mapShopifyProduct(data.product);
    upsertProduct.run({ ...mapped, handle: mapped.handle || '' });

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(product);
  } catch (err) {
    console.error('Update product error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.errors || err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const local = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!local) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await shopifyRequest('DELETE', `/products/${local.shopify_id}.json`);
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete product error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.errors || err.message });
  }
});

router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const deleted = [];
    for (const id of ids) {
      const local = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!local) continue;
      try {
        await shopifyRequest('DELETE', `/products/${local.shopify_id}.json`);
        db.prepare('DELETE FROM products WHERE id = ?').run(id);
        deleted.push(id);
      } catch (err) {
        console.error(`Failed to delete product ${id}:`, err.message);
      }
    }

    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk-price', async (req, res) => {
  try {
    const { ids, mode, value } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const updated = [];

    for (const id of ids) {
      const local = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!local) continue;

      let newPrice = local.price;
      const numValue = parseFloat(value) || 0;

      switch (mode) {
        case 'fixed':
          newPrice = numValue;
          break;
        case 'increase_percent':
          newPrice = local.price * (1 + numValue / 100);
          break;
        case 'decrease_percent':
          newPrice = local.price * (1 - numValue / 100);
          break;
        case 'increase_amount':
          newPrice = local.price + numValue;
          break;
        case 'decrease_amount':
          newPrice = Math.max(0, local.price - numValue);
          break;
        default:
          continue;
      }

      newPrice = Math.round(newPrice * 100) / 100;

      const shopifyData = await shopifyRequest(
        'GET',
        `/products/${local.shopify_id}.json`
      );
      const variantId = shopifyData.product.variants?.[0]?.id;

      await shopifyRequest('PUT', `/products/${local.shopify_id}.json`, {
        product: {
          id: parseInt(local.shopify_id, 10),
          variants: [{ id: variantId, price: String(newPrice) }],
        },
      });

      db.prepare('UPDATE products SET price = ? WHERE id = ?').run(newPrice, id);
      updated.push({ id, price: newPrice });
    }

    res.json({ success: true, updated });
  } catch (err) {
    console.error('Bulk price error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Only CSV files allowed') {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

module.exports = router;

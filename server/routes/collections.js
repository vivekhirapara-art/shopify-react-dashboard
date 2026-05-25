const express = require('express');
const { shopifyRequest } = require('../utils/shopify');
const { getRequestCredentials } = require('../middleware/shopifyContext');

const router = express.Router();

function mapCollection(c, kind) {
  return {
    id: String(c.id),
    title: c.title,
    handle: c.handle,
    description: c.body_html ? c.body_html.replace(/<[^>]+>/g, '').slice(0, 200) : '',
    image: c.image?.src || null,
    products_count: c.products_count ?? 0,
    published: c.published_at != null,
    status: c.published_at ? 'active' : 'draft',
    kind,
    updated_at: c.updated_at,
  };
}

router.get('/', async (req, res) => {
  const { storeUrl, accessToken } = getRequestCredentials(req);
  if (!storeUrl || !accessToken) {
    return res.status(401).json({ error: 'Store credentials required', collections: [], stats: { total: 0, active: 0, productsInCollections: 0 } });
  }
  try {
    const [custom, smart] = await Promise.all([
      shopifyRequest('GET', '/custom_collections.json?limit=250'),
      shopifyRequest('GET', '/smart_collections.json?limit=250'),
    ]);

    const collections = [
      ...(custom.custom_collections || []).map((c) => mapCollection(c, 'custom')),
      ...(smart.smart_collections || []).map((c) => mapCollection(c, 'smart')),
    ];

    res.json({
      collections,
      stats: {
        total: collections.length,
        active: collections.filter((c) => c.status === 'active').length,
        productsInCollections: collections.reduce((s, c) => s + (c.products_count || 0), 0),
      },
    });
  } catch (err) {
    console.error('Collections fetch:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errors || err.message,
      collections: [],
      stats: { total: 0, active: 0, productsInCollections: 0 },
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, image, product_ids, published } = req.body;
    const payload = {
      custom_collection: {
        title: title || 'New Collection',
        body_html: description || '',
        published: published !== false,
      },
    };
    if (image) payload.custom_collection.image = { src: image };

    const data = await shopifyRequest('POST', '/custom_collections.json', payload);
    const collection = data.custom_collection;

    if (product_ids?.length) {
      const collects = product_ids.map((productId) => ({
        product_id: parseInt(productId, 10),
        collection_id: collection.id,
      }));
      for (const collect of collects) {
        try {
          await shopifyRequest('POST', '/collects.json', { collect });
        } catch (e) {
          console.warn('Collect add failed:', e.message);
        }
      }
    }

    res.status(201).json(mapCollection(collection, 'custom'));
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.errors || err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { title, description, image, published, kind } = req.body;

    if (kind === 'smart') {
      const payload = {
        smart_collection: {
          id: parseInt(id, 10),
          title: title || 'Collection',
          body_html: description || '',
          published: published !== false,
        },
      };
      if (image) payload.smart_collection.image = { src: image };
      const data = await shopifyRequest('PUT', `/smart_collections/${id}.json`, payload);
      return res.json(mapCollection(data.smart_collection, 'smart'));
    }

    const payload = {
      custom_collection: {
        id: parseInt(id, 10),
        title: title || 'Collection',
        body_html: description || '',
        published: published !== false,
      },
    };
    if (image) payload.custom_collection.image = { src: image };

    const data = await shopifyRequest('PUT', `/custom_collections/${id}.json`, payload);
    res.json(mapCollection(data.custom_collection, 'custom'));
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errors || err.message,
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { kind } = req.query;

    if (kind === 'smart') {
      await shopifyRequest('DELETE', `/smart_collections/${id}.json`);
    } else {
      try {
        await shopifyRequest('DELETE', `/custom_collections/${id}.json`);
      } catch {
        await shopifyRequest('DELETE', `/smart_collections/${id}.json`);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errors || err.message,
    });
  }
});

module.exports = router;

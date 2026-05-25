const express = require('express');
const { db } = require('../db');
const { shopifyRequest } = require('../utils/shopify');
const { saveOrderFromShopify, formatOrderRow } = require('../utils/orderDb');
const { getRequestCredentials } = require('../middleware/shopifyContext');

const router = express.Router();

router.get('/', async (req, res) => {
  const { storeUrl, accessToken } = getRequestCredentials(req);
  if (!storeUrl || !accessToken) {
    return res.status(401).json({ error: 'Store credentials required', orders: [] });
  }
  try {
    const data = await shopifyRequest('GET', '/orders.json?status=any&limit=250');
    const shopifyOrders = data.orders || [];

    for (const order of shopifyOrders) {
      saveOrderFromShopify(order);
    }

    const orders = db
      .prepare('SELECT * FROM orders ORDER BY created_at DESC')
      .all()
      .map((row) => {
        const items = db
          .prepare('SELECT product_title, quantity, price FROM order_items WHERE order_id = ?')
          .all(row.id);
        return formatOrderRow(row, items);
      });

    res.json({ orders, syncError: null, needsScope: false });
  } catch (err) {
    const shopifyError =
      err.response?.data?.errors ||
      err.response?.data?.error ||
      err.message;
    console.error('Orders fetch error:', shopifyError);

    const localOrders = db
      .prepare('SELECT * FROM orders ORDER BY created_at DESC')
      .all()
      .map((row) => {
        const items = db
          .prepare('SELECT product_title, quantity, price FROM order_items WHERE order_id = ?')
          .all(row.id);
        return formatOrderRow(row, items);
      });

    const needsScope =
      String(shopifyError).includes('read_orders') ||
      String(shopifyError).includes('merchant approval');

    res.json({
      orders: localOrders,
      syncError: needsScope
        ? 'read_orders is configured but not approved on your store yet. Install (or reinstall) the app on testing24v and approve Orders permission, then generate a new access token.'
        : String(shopifyError),
      needsScope,
    });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (row.status === 'cancelled') {
      return res.status(400).json({ error: 'Order is already cancelled' });
    }

    const cancelData = await shopifyRequest(
      'POST',
      `/orders/${row.shopify_order_id}/cancel.json`,
      {
        restock: true,
        reason: req.body?.reason || 'customer',
        email: false,
      }
    );

    const shopifyOrder =
      cancelData.order ||
      (await shopifyRequest('GET', `/orders/${row.shopify_order_id}.json`)).order;

    const orderData = saveOrderFromShopify(shopifyOrder, { adjustStock: 'restore' });

    const io = req.app.get('io');
    if (io) {
      io.emit('order_updated', { ...orderData, event: 'cancelled' });
    }

    res.json({ success: true, order: orderData });
  } catch (err) {
    console.error('Cancel order error:', err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.errors || err.response?.data?.error || err.message,
    });
  }
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Order not found' });
  }
  const items = db
    .prepare('SELECT product_title, quantity, price FROM order_items WHERE order_id = ?')
    .all(row.id);
  res.json(formatOrderRow(row, items));
});

module.exports = router;

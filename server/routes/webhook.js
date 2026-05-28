const express = require('express');
const verifyShopify = require('../middleware/verifyShopify');
const { saveOrderFromShopify } = require('../utils/orderDb');
const { db } = require('../db');
const { createNotification } = require('../utils/notificationsDb');
const { logSync } = require('../utils/syncLogDb');

const router = express.Router();

function recordWebhookPing(slug) {
  db.prepare(
    `INSERT INTO sync_meta (key, value) VALUES (?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(`webhook_last_${slug}`);
}

const rawJson = [
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    req.rawBody = req.body;
    next();
  },
  verifyShopify,
];

function handleOrderWebhook(req, res, { event, adjustStock = false, emitCreated = false }) {
  const start = Date.now();
  try {
    const order = req.shopifyPayload;
    console.log('Webhook received:', order && order.id);
    const orderData = saveOrderFromShopify(order, { adjustStock });

    if (emitCreated) {
      const items = order.line_items?.length || 0;
      createNotification({
        type: 'order',
        title: `New Order ${order.name || '#' + order.id}`,
        message: `${orderData.customer_name || 'Customer'} ordered ${items} item(s) — $${parseFloat(orderData.total_price || 0).toFixed(2)}`,
      });
      logSync({
        type: 'webhook',
        status: 'success',
        total: 1,
        new_count: 1,
        duration_ms: Date.now() - start,
        details: { event: 'order-created', order_id: orderData.shopify_order_id },
      });
    }

    const io = req.app.get('io');
    if (io) {
      if (emitCreated) {
        io.emit('new_order', orderData);
      } else {
        io.emit('order_updated', { ...orderData, event });
      }
    }

    // Shopify expects a 200 OK quickly for webhooks.
    res.status(200).json({ success: true, event, order: orderData });
  } catch (err) {
    console.error(`Webhook ${event} error:`, err);
    // Always return 200 so Shopify doesn't retry endlessly on our failures.
    res.status(200).json({ success: false, event, error: err.message });
  }
}

router.post('/order-created', ...rawJson, (req, res) => {
  recordWebhookPing('order-created');
  handleOrderWebhook(req, res, { event: 'created', adjustStock: 'decrease', emitCreated: true });
});

router.post('/order-updated', ...rawJson, (req, res) => {
  recordWebhookPing('order-updated');
  const isCancelled = Boolean(req.shopifyPayload?.cancelled_at);
  handleOrderWebhook(req, res, {
    event: isCancelled ? 'cancelled' : 'updated',
    adjustStock: isCancelled ? 'restore' : false,
  });
});

router.post('/order-cancelled', ...rawJson, (req, res) => {
  recordWebhookPing('order-cancelled');
  handleOrderWebhook(req, res, { event: 'cancelled', adjustStock: 'restore' });
});

module.exports = router;

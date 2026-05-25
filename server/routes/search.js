const express = require('express');
const { db } = require('../db');
const { getRequestCredentials } = require('../middleware/shopifyContext');

const router = express.Router();

router.get('/', (req, res) => {
  const { storeUrl, accessToken } = getRequestCredentials(req);
  if (!storeUrl || !accessToken) {
    return res.status(401).json({ products: [], orders: [], customers: [] });
  }

  const q = String(req.query.q || '').trim();
  if (!q || q.length < 1) {
    return res.json({ products: [], orders: [], customers: [] });
  }

  const like = `%${q}%`;

  try {
    const products = db
      .prepare(
        `SELECT shopify_id, title, price, image, vendor, stock
         FROM products
         WHERE title LIKE ? OR vendor LIKE ? OR shopify_id LIKE ?
         ORDER BY title ASC
         LIMIT 3`
      )
      .all(like, like, like)
      .map((p) => ({
        id: p.shopify_id,
        title: p.title,
        subtitle: p.vendor || `Stock: ${p.stock}`,
        price: p.price,
        image: p.image,
      }));

    const orders = db
      .prepare(
        `SELECT id, shopify_order_id, customer_name, customer_email, total_price, status
         FROM orders
         WHERE shopify_order_id LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?
         ORDER BY created_at DESC
         LIMIT 3`
      )
      .all(like, like, like)
      .map((o) => ({
        id: o.shopify_order_id,
        title: `#${o.shopify_order_id}`,
        subtitle: o.customer_name || o.customer_email || 'Guest',
        total_price: o.total_price,
        status: o.status,
      }));

    const customers = db
      .prepare(
        `SELECT customer_name, customer_email, COUNT(*) as order_count, MAX(total_price) as last_total
         FROM orders
         WHERE (customer_name IS NOT NULL AND customer_name != '') 
           AND (customer_name LIKE ? OR customer_email LIKE ?)
         GROUP BY COALESCE(customer_email, customer_name)
         ORDER BY order_count DESC
         LIMIT 3`
      )
      .all(like, like)
      .map((c) => ({
        id: c.customer_email || c.customer_name,
        title: c.customer_name || 'Unknown',
        subtitle: c.customer_email || `${c.order_count} orders`,
      }));

    res.json({ products, orders, customers, query: q });
  } catch (err) {
    res.status(500).json({ error: err.message, products: [], orders: [], customers: [] });
  }
});

module.exports = router;

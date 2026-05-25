const express = require('express');
const { shopifyRequest } = require('../utils/shopify');
const { db } = require('../db');
const { getRequestCredentials } = require('../middleware/shopifyContext');

const router = express.Router();

function mapCustomer(c) {
  const ordersCount = c.orders_count ?? 0;
  const totalSpent = parseFloat(c.total_spent || 0);
  let tag = 'New';
  if (ordersCount >= 5) tag = 'VIP';
  else if (ordersCount >= 2) tag = 'Regular';

  return {
    id: String(c.id),
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Guest',
    email: c.email || '',
    phone: c.phone || '',
    orders_count: ordersCount,
    total_spent: totalSpent,
    last_order_at: c.last_order_name ? c.updated_at : c.created_at,
    city: c.default_address?.city || '',
    country: c.default_address?.country || '',
    country_code: c.default_address?.country_code || '',
    address: c.default_address
      ? [
          c.default_address.address1,
          c.default_address.city,
          c.default_address.province,
          c.default_address.country,
        ]
          .filter(Boolean)
          .join(', ')
      : '',
    tag,
    created_at: c.created_at,
  };
}

router.get('/', async (req, res) => {
  const { storeUrl, accessToken } = getRequestCredentials(req);
  if (!storeUrl || !accessToken) {
    return res.status(401).json({ error: 'Store credentials required', customers: [], stats: { total: 0, newThisMonth: 0, repeatBuyers: 0, totalRevenue: 0 } });
  }
  try {
    const data = await shopifyRequest('GET', '/customers.json?limit=250');
    const customers = (data.customers || []).map(mapCustomer);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = customers.filter(
      (c) => c.created_at && new Date(c.created_at) >= monthStart
    ).length;
    const repeatBuyers = customers.filter((c) => c.orders_count >= 2).length;
    const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0);

    res.json({
      customers,
      stats: {
        total: customers.length,
        newThisMonth,
        repeatBuyers,
        totalRevenue,
      },
    });
  } catch (err) {
    console.error('Customers fetch:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.errors || err.message,
      customers: [],
      stats: { total: 0, newThisMonth: 0, repeatBuyers: 0, totalRevenue: 0 },
    });
  }
});

router.get('/:id/orders', async (req, res) => {
  try {
    const customerId = req.params.id;
    let email = '';
    try {
      const { customer } = await shopifyRequest('GET', `/customers/${customerId}.json`);
      email = customer.email || '';
    } catch {
      /* ignore */
    }

    let orders = [];
    try {
      const data = await shopifyRequest('GET', `/customers/${customerId}/orders.json?status=any`);
      orders = data.orders || [];
    } catch {
      if (email) {
        orders = db
          .prepare('SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC LIMIT 10')
          .all(email);
      }
    }

    const mapped = orders.slice(0, 10).map((o) => ({
      id: o.name || o.shopify_order_id || String(o.id),
      shopify_order_id: String(o.id),
      total_price: parseFloat(o.total_price || 0),
      status: o.financial_status || o.status || 'pending',
      created_at: o.created_at,
      items_count: o.line_items?.length || 0,
    }));

    res.json({ orders: mapped });
  } catch (err) {
    res.status(500).json({ error: err.message, orders: [] });
  }
});

module.exports = router;

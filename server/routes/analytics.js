const express = require('express');
const { db } = require('../db');
const { getRequestCredentials } = require('../middleware/shopifyContext');
const { getActiveStoreUrl } = require('../utils/storeData');

const router = express.Router();

function formatInventoryValue(value) {
  const val = Number(value) || 0;
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

const emptyPayload = {
  total_products: 0,
  inventory_value: '$0.00',
  inventory_value_raw: 0,
  low_stock: 0,
  low_stock_products: [],
  out_of_stock: 0,
  total_orders: 0,
  by_status: { active: 0, draft: 0, archived: 0 },
  stock_distribution: { in_stock: 0, low: 0, out: 0 },
  sales_last_30_days: [],
  top_products_by_value: [],
  today_summary: {
    orders_today: 0,
    revenue_today: 0,
    new_customers_today: 0,
    orders_sparkline: [],
    revenue_sparkline: [],
    customers_sparkline: [],
  },
  orders_last_14_days: [],
  orders_this_month: 0,
};

router.get('/', (req, res) => {
  const { storeUrl } = getRequestCredentials(req);
  const activeStore = getActiveStoreUrl();
  if (storeUrl && activeStore && storeUrl !== activeStore) {
    return res.json(emptyPayload);
  }

  const inventoryResult = db
    .prepare(
      `SELECT SUM(CAST(price AS REAL) * CAST(stock AS INTEGER)) AS total
       FROM (
         SELECT shopify_id, price, stock
         FROM products
         GROUP BY shopify_id
       )`
    )
    .get();
  const inventoryValueRaw = inventoryResult?.total ?? 0;

  const lowStockRow = db
    .prepare(
      `SELECT COUNT(*) AS count FROM (
         SELECT DISTINCT shopify_id FROM products
         WHERE stock > 0 AND stock <= 10
       )`
    )
    .get();
  const lowStock = lowStockRow?.count ?? 0;

  const lowStockProducts = db
    .prepare(
      `SELECT shopify_id, title, price, stock, status, image, vendor, id
       FROM products
       WHERE stock > 0 AND stock <= 10
       GROUP BY shopify_id
       ORDER BY stock ASC
       LIMIT 10`
    )
    .all();

  const outOfStockRow = db
    .prepare(
      `SELECT COUNT(*) AS count FROM (
         SELECT DISTINCT shopify_id FROM products WHERE stock = 0
       )`
    )
    .get();
  const outOfStock = outOfStockRow?.count ?? 0;

  const inStockRow = db
    .prepare(
      `SELECT COUNT(*) AS count FROM (
         SELECT DISTINCT shopify_id FROM products WHERE stock > 10
       )`
    )
    .get();
  const inStock = inStockRow?.count ?? 0;

  const totalProductsRow = db
    .prepare(`SELECT COUNT(DISTINCT shopify_id) AS count FROM products`)
    .get();
  const totalProducts = totalProductsRow?.count ?? 0;

  const byStatus = { active: 0, draft: 0, archived: 0 };
  const statusRows = db
    .prepare(
      `SELECT status, COUNT(*) AS count FROM (
         SELECT shopify_id, status FROM products GROUP BY shopify_id
       )
       GROUP BY status`
    )
    .all();
  for (const row of statusRows) {
    const status = (row.status || 'active').toLowerCase();
    if (byStatus[status] !== undefined) {
      byStatus[status] = row.count;
    } else {
      byStatus.active += row.count;
    }
  }

  const orders = db.prepare('SELECT COUNT(*) as count FROM orders').get();
  const totalOrders = orders?.count || 0;

  const revenueByDay = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    revenueByDay[key] = 0;
  }

  const allOrders = db.prepare('SELECT total_price, created_at FROM orders').all();
  for (const order of allOrders) {
    const dateKey = (order.created_at || '').split('T')[0].split(' ')[0];
    if (revenueByDay[dateKey] !== undefined) {
      revenueByDay[dateKey] += order.total_price;
    }
  }

  const salesLast30Days = Object.entries(revenueByDay).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  const topProducts = db
    .prepare(
      `SELECT shopify_id, title, price, stock,
        CAST(price AS REAL) * CAST(stock AS INTEGER) AS total_value
       FROM products
       WHERE LOWER(COALESCE(status, 'active')) = 'active'
       GROUP BY shopify_id
       ORDER BY total_value DESC
       LIMIT 5`
    )
    .all();

  const todayKey = new Date().toISOString().split('T')[0];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const ordersDetail = db
    .prepare('SELECT total_price, created_at, customer_email FROM orders')
    .all();

  const ordersTodayList = ordersDetail.filter((o) => (o.created_at || '').startsWith(todayKey));
  const revenueToday = ordersTodayList.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const newCustomersToday = new Set(
    ordersTodayList.map((o) => o.customer_email).filter(Boolean)
  ).size;

  const ordersLast14Days = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    ordersLast14Days[d.toISOString().split('T')[0]] = 0;
  }
  let ordersThisMonth = 0;
  for (const order of ordersDetail) {
    const dateKey = (order.created_at || '').split('T')[0].split(' ')[0];
    if (ordersLast14Days[dateKey] !== undefined) {
      ordersLast14Days[dateKey]++;
    }
    if (order.created_at && new Date(order.created_at) >= monthStart) {
      ordersThisMonth++;
    }
  }

  const ordersByDay14 = Object.entries(ordersLast14Days).map(([date, count]) => ({
    date,
    count,
  }));

  const sparkDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    sparkDays.push(d.toISOString().split('T')[0]);
  }
  const ordersSparkline = sparkDays.map((key) => ({
    v: ordersDetail.filter((o) => (o.created_at || '').startsWith(key)).length,
  }));
  const revenueSparkline = sparkDays.map((key) => ({
    v: ordersDetail
      .filter((o) => (o.created_at || '').startsWith(key))
      .reduce((s, o) => s + (o.total_price || 0), 0),
  }));
  const customersSparkline = sparkDays.map((key) => ({
    v: new Set(
      ordersDetail
        .filter((o) => (o.created_at || '').startsWith(key))
        .map((o) => o.customer_email)
        .filter(Boolean)
    ).size,
  }));

  res.json({
    total_products: totalProducts,
    inventory_value: formatInventoryValue(inventoryValueRaw),
    inventory_value_raw: inventoryValueRaw,
    low_stock: lowStock,
    low_stock_products: lowStockProducts,
    out_of_stock: outOfStock,
    total_orders: totalOrders,
    by_status: byStatus,
    stock_distribution: { in_stock: inStock, low: lowStock, out: outOfStock },
    sales_last_30_days: salesLast30Days,
    top_products_by_value: topProducts,
    today_summary: {
      orders_today: ordersTodayList.length,
      revenue_today: revenueToday,
      new_customers_today: newCustomersToday,
      orders_sparkline: ordersSparkline,
      revenue_sparkline: revenueSparkline,
      customers_sparkline: customersSparkline,
    },
    orders_last_14_days: ordersByDay14,
    orders_this_month: ordersThisMonth,
  });
});

module.exports = router;

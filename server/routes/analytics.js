const express = require('express');
const { db } = require('../db');
const { getRequestCredentials } = require('../middleware/shopifyContext');
const { getActiveStoreUrl, ensureStoreContext, normalizeStoreUrl } = require('../utils/storeData');
const { normalizeProductImageUrl } = require('../utils/productImage');
const { toLocalDateKey, getLocalDateKeysForLastDays } = require('../utils/dateUtils');

const router = express.Router();

/** Orders that should not count toward sales/revenue metrics */
function isCancelledOrder(order) {
  return String(order.status || '').toLowerCase() === 'cancelled';
}

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
  const normalizedStore = storeUrl ? ensureStoreContext(storeUrl) : null;
  const activeStore = getActiveStoreUrl();
  if (
    normalizedStore &&
    activeStore &&
    normalizeStoreUrl(normalizedStore) !== normalizeStoreUrl(activeStore)
  ) {
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
  for (const key of getLocalDateKeysForLastDays(30)) {
    revenueByDay[key] = 0;
  }

  const allOrders = db
    .prepare(
      `SELECT total_price, created_at, status
       FROM orders
       WHERE LOWER(COALESCE(status, '')) != 'cancelled'`
    )
    .all();
  for (const order of allOrders) {
    const dateKey = toLocalDateKey(order.created_at);
    if (dateKey && revenueByDay[dateKey] !== undefined) {
      revenueByDay[dateKey] += order.total_price || 0;
    }
  }

  const salesLast30Days = Object.entries(revenueByDay).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  const topProducts = db
    .prepare(
      `SELECT shopify_id,
        MAX(title) AS title,
        MAX(CAST(price AS REAL)) AS price,
        MAX(CAST(stock AS INTEGER)) AS stock,
        MAX(CAST(price AS REAL) * CAST(stock AS INTEGER)) AS total_value
       FROM products
       WHERE LOWER(COALESCE(status, 'active')) = 'active'
         AND CAST(price AS REAL) <= 100000
       GROUP BY shopify_id
       ORDER BY total_value DESC
       LIMIT 5`
    )
    .all();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const ordersDetail = db
    .prepare('SELECT total_price, created_at, customer_email, status FROM orders')
    .all();

  const revenueOrders = ordersDetail.filter((o) => !isCancelledOrder(o));

  const ordersTodayList = revenueOrders.filter((o) => {
    if (!o.created_at) return false;
    const created = new Date(
      String(o.created_at).includes('T')
        ? o.created_at
        : String(o.created_at).replace(' ', 'T')
    );
    return !Number.isNaN(created.getTime()) && created >= new Date(todayISO);
  });
  const revenueToday = ordersTodayList.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const newCustomersToday = new Set(
    ordersTodayList.map((o) => o.customer_email).filter(Boolean)
  ).size;

  const ordersLast14Days = {};
  for (const key of getLocalDateKeysForLastDays(14)) {
    ordersLast14Days[key] = 0;
  }
  let ordersThisMonth = 0;
  for (const order of revenueOrders) {
    const dateKey = toLocalDateKey(order.created_at);
    if (dateKey && ordersLast14Days[dateKey] !== undefined) {
      ordersLast14Days[dateKey]++;
    }
    if (order.created_at) {
      const parsed = new Date(
        String(order.created_at).includes('T')
          ? order.created_at
          : String(order.created_at).replace(' ', 'T')
      );
      if (!Number.isNaN(parsed.getTime()) && parsed >= monthStart) {
        ordersThisMonth++;
      }
    }
  }

  const ordersByDay14 = Object.entries(ordersLast14Days).map(([date, count]) => ({
    date,
    count,
  }));

  const sparkDays = getLocalDateKeysForLastDays(7);
  const ordersSparkline = sparkDays.map((key) => ({
    v: revenueOrders.filter((o) => toLocalDateKey(o.created_at) === key).length,
  }));
  const revenueSparkline = sparkDays.map((key) => ({
    v: revenueOrders
      .filter((o) => toLocalDateKey(o.created_at) === key)
      .reduce((s, o) => s + (o.total_price || 0), 0),
  }));
  const customersSparkline = sparkDays.map((key) => ({
    v: new Set(
      revenueOrders
        .filter((o) => toLocalDateKey(o.created_at) === key)
        .map((o) => o.customer_email)
        .filter(Boolean)
    ).size,
  }));

  res.json({
    total_products: totalProducts,
    inventory_value: formatInventoryValue(inventoryValueRaw),
    inventory_value_raw: inventoryValueRaw,
    low_stock: lowStock,
    low_stock_products: lowStockProducts.map((p) => ({
      ...p,
      image: normalizeProductImageUrl(p.image),
    })),
    out_of_stock: outOfStock,
    total_orders: totalOrders,
    by_status: byStatus,
    stock_distribution: { in_stock: inStock, low: lowStock, out: outOfStock },
    sales_last_30_days: salesLast30Days,
    top_products_by_value: topProducts.map((p) => ({
      ...p,
      image: normalizeProductImageUrl(p.image),
    })),
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

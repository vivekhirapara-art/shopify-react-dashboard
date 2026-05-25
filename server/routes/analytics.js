const express = require('express');
const { db } = require('../db');
const { getRequestCredentials } = require('../middleware/shopifyContext');
const { getActiveStoreUrl } = require('../utils/storeData');

const router = express.Router();

function formatCurrency(value) {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

router.get('/', (req, res) => {
  const { storeUrl } = getRequestCredentials(req);
  const activeStore = getActiveStoreUrl();
  if (storeUrl && activeStore && storeUrl !== activeStore) {
    return res.json({
      total_products: 0,
      inventory_value: '$0',
      inventory_value_raw: 0,
      low_stock: 0,
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
    });
  }

  const products = db.prepare('SELECT * FROM products').all();

  const totalProducts = products.length;
  const inventoryValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const lowStock = products.filter((p) => p.stock >= 1 && p.stock <= 9).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const inStock = products.filter((p) => p.stock >= 10).length;
  const low = products.filter((p) => p.stock >= 1 && p.stock <= 9).length;
  const out = products.filter((p) => p.stock === 0).length;

  const byStatus = { active: 0, draft: 0, archived: 0 };
  for (const p of products) {
    const status = (p.status || 'active').toLowerCase();
    if (byStatus[status] !== undefined) {
      byStatus[status]++;
    } else {
      byStatus.active++;
    }
  }

  const orders = db.prepare('SELECT COUNT(*) as count FROM orders').get();
  const totalOrders = orders?.count || 0;

  const revenueByDay = {};
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentOrders = db
    .prepare('SELECT total_price, created_at FROM orders WHERE created_at >= ? ORDER BY created_at')
    .all(thirtyDaysAgo.toISOString());

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

  const topProducts = [...products]
    .map((p) => ({
      title: p.title,
      price: p.price,
      stock: p.stock,
      image: p.image,
      total_value: p.price * p.stock,
    }))
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, 5);

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
    inventory_value: formatCurrency(inventoryValue),
    inventory_value_raw: inventoryValue,
    low_stock: lowStock,
    out_of_stock: outOfStock,
    total_orders: totalOrders,
    by_status: byStatus,
    stock_distribution: { in_stock: inStock, low, out },
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

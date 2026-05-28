const { db } = require('../db');
const { mapOrderStatus } = require('./orderStatus');

function getCustomerNameFromShopifyOrder(order) {
  return (
    (order.billing_address && order.billing_address.name) ||
    (order.shipping_address && order.shipping_address.name) ||
    (order.customer && order.customer.first_name && order.customer.last_name
      ? (order.customer.first_name + ' ' + order.customer.last_name).trim()
      : null) ||
    order.email ||
    'Unknown Customer'
  );
}

function formatCustomerDisplay(row) {
  const name = (row.customer_name || '').trim();
  if (name && !/^guest$/i.test(name) && !/^anonymous$/i.test(name)) {
    return name;
  }
  if (row.customer_email) return row.customer_email;
  return name || `Order #${row.shopify_order_id}`;
}

function saveOrderFromShopify(order, { adjustStock = false, customerName: nameOverride } = {}) {
  const shopifyOrderId = String(order.id);
  const customerName =
    nameOverride != null && nameOverride !== ''
      ? nameOverride
      : getCustomerNameFromShopifyOrder(order);
  const customerEmail =
    (order.customer && order.customer.email) ||
    order.email ||
    order.contact_email ||
    '';
  const totalPrice = parseFloat(order.total_price || 0);
  const status = mapOrderStatus(order);

  const existing = db
    .prepare('SELECT id FROM orders WHERE shopify_order_id = ?')
    .get(shopifyOrderId);

  let orderId;
  if (existing) {
    orderId = existing.id;
    db.prepare(
      `UPDATE orders SET customer_name = ?, customer_email = ?, total_price = ?, status = ? WHERE id = ?`
    ).run(customerName, customerEmail, totalPrice, status, orderId);
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
  } else {
    const result = db
      .prepare(
        `INSERT INTO orders (shopify_order_id, customer_name, customer_email, total_price, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        shopifyOrderId,
        customerName,
        customerEmail,
        totalPrice,
        status,
        order.created_at || new Date().toISOString()
      );
    orderId = result.lastInsertRowid;
  }

  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_title, quantity, price) VALUES (?, ?, ?, ?)`
  );

  for (const item of order.line_items || []) {
    insertItem.run(
      orderId,
      item.title || item.name || 'Unknown',
      item.quantity || 1,
      parseFloat(item.price || 0)
    );

    if (item.product_id) {
      const product = db
        .prepare('SELECT id, stock FROM products WHERE shopify_id = ?')
        .get(String(item.product_id));

      if (product && adjustStock) {
        const qty = item.quantity || 1;
        const newStock =
          adjustStock === 'restore'
            ? product.stock + qty
            : Math.max(0, product.stock - qty);
        db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, product.id);
      }
    }
  }

  const items = (order.line_items || []).map((item) => ({
    product_title: item.title || item.name,
    quantity: item.quantity,
    price: parseFloat(item.price || 0),
  }));

  return {
    id: orderId,
    shopify_order_id: shopifyOrderId,
    customer_name: customerName,
    customer_email: customerEmail,
    total_price: totalPrice,
    status,
    created_at: order.created_at || new Date().toISOString(),
    cancelled_at: order.cancelled_at || null,
    items,
  };
}

function formatOrderRow(row, items) {
  return {
    id: row.id,
    shopify_order_id: row.shopify_order_id,
    customer_name: formatCustomerDisplay(row),
    customer_email: row.customer_email,
    total_price: row.total_price,
    status: row.status,
    created_at: row.created_at,
    items: items || [],
  };
}

module.exports = {
  saveOrderFromShopify,
  formatOrderRow,
  getCustomerNameFromShopifyOrder,
};

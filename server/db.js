const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'shopify.db');
const db = new Database(dbPath);

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopify_id TEXT UNIQUE NOT NULL,
      handle TEXT,
      title TEXT NOT NULL,
      description TEXT,
      price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      image TEXT,
      vendor TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopify_order_id TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      customer_email TEXT,
      total_price REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_title TEXT,
      quantity INTEGER DEFAULT 1,
      price REAL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'system',
      title TEXT NOT NULL,
      message TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'success',
      total INTEGER DEFAULT 0,
      new_count INTEGER DEFAULT 0,
      updated_count INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      error TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      file_path TEXT,
      size INTEGER DEFAULT 0,
      width INTEGER,
      height INTEGER,
      mime_type TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  try {
    db.exec('ALTER TABLE products ADD COLUMN handle TEXT');
  } catch {
    /* column already exists */
  }

  try {
    db.exec('ALTER TABLE products ADD COLUMN description TEXT');
  } catch {
    /* column already exists */
  }
}

module.exports = { db, initDatabase };

const { db } = require('../db');

const insertNotification = db.prepare(`
  INSERT INTO notifications (type, title, message, read, created_at)
  VALUES (@type, @title, @message, 0, datetime('now'))
`);

function createNotification({ type, title, message }) {
  const result = insertNotification.run({ type, title, message });
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);
}

function listNotifications(limit = 200) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 200);
  const rows = db
    .prepare(
      `SELECT * FROM notifications
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(safeLimit);

  const seen = new Set();
  return rows
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .map((row) => ({ ...row, read: Boolean(row.read) }));
}

module.exports = { createNotification, listNotifications };

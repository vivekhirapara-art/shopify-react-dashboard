const { db } = require('../db');

const insertLog = db.prepare(`
  INSERT INTO sync_logs (type, status, total, new_count, updated_count, duration_ms, error, details, created_at)
  VALUES (@type, @status, @total, @new_count, @updated_count, @duration_ms, @error, @details, datetime('now'))
`);

function logSync({
  type = 'manual',
  status = 'success',
  total = 0,
  new_count = 0,
  updated_count = 0,
  duration_ms = 0,
  error = null,
  details = null,
}) {
  const result = insertLog.run({
    type,
    status,
    total,
    new_count,
    updated_count,
    duration_ms,
    error: error ? String(error) : null,
    details: details ? JSON.stringify(details) : null,
  });
  return db.prepare('SELECT * FROM sync_logs WHERE id = ?').get(result.lastInsertRowid);
}

function listSyncLogs(limit = 100) {
  return db
    .prepare('SELECT * FROM sync_logs ORDER BY datetime(created_at) DESC LIMIT ?')
    .all(limit)
    .map((row) => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
    }));
}

function clearSyncLogs() {
  db.prepare('DELETE FROM sync_logs').run();
}

function getSyncLogStats() {
  const rows = db.prepare('SELECT status, duration_ms FROM sync_logs').all();
  const total = rows.length;
  const successful = rows.filter((r) => r.status === 'success').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const durations = rows.filter((r) => r.duration_ms).map((r) => r.duration_ms);
  const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  return { total, successful, failed, avgMs };
}

module.exports = { logSync, listSyncLogs, clearSyncLogs, getSyncLogStats };

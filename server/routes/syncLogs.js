const express = require('express');
const { listSyncLogs, clearSyncLogs, getSyncLogStats } = require('../utils/syncLogDb');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { status, type, limit } = req.query;
    let logs = listSyncLogs(parseInt(limit, 10) || 100);

    if (status && status !== 'all') {
      logs = logs.filter((l) => l.status === status);
    }
    if (type && type !== 'all') {
      logs = logs.filter((l) => l.type === type);
    }

    const stats = getSyncLogStats();
    const lastSyncRow = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get();

    res.json({
      logs,
      stats: {
        total: stats.total,
        successful: stats.successful,
        failed: stats.failed,
        avgSeconds: stats.avgMs ? (stats.avgMs / 1000).toFixed(1) : '0',
      },
      last_sync: lastSyncRow?.value || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/clear', (_req, res) => {
  try {
    clearSyncLogs();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

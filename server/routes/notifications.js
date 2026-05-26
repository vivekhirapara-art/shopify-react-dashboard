const express = require('express');
const { db } = require('../db');
const { listNotifications } = require('../utils/notificationsDb');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 200;
    const items = listNotifications(limit);
    const unread = items.filter((n) => !n.read).length;
    res.json({ notifications: items, unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/read-all', (_req, res) => {
  try {
    db.prepare('UPDATE notifications SET read = 1').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/all', (_req, res) => {
  try {
    db.prepare('DELETE FROM notifications').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/read', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ ...row, read: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    if (!result.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

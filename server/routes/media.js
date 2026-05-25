const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const router = express.Router();
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG, WebP, GIF allowed'), ok);
  },
});

const insertMedia = db.prepare(`
  INSERT INTO media (filename, url, file_path, size, mime_type, created_at)
  VALUES (@filename, @url, @file_path, @size, @mime_type, datetime('now'))
`);

function rowToMedia(row, req) {
  const base = `${req.protocol}://${req.get('host')}`;
  const url = row.url.startsWith('http') ? row.url : `${base}${row.url}`;
  const products = db
    .prepare('SELECT title, shopify_id FROM products WHERE image = ? OR image LIKE ?')
    .all(url, `%${row.filename}%`);

  return {
    id: row.id,
    filename: row.filename,
    url,
    size: row.size,
    width: row.width,
    height: row.height,
    mime_type: row.mime_type,
    created_at: row.created_at,
    used_in: products,
    used: products.length > 0,
  };
}

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM media ORDER BY datetime(created_at) DESC').all();
    const items = rows.map((r) => rowToMedia(r, req));
    res.json({ media: items, count: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const url = `/uploads/${req.file.filename}`;
    const result = insertMedia.run({
      filename: req.file.originalname,
      url,
      file_path: req.file.path,
      size: req.file.size,
      mime_type: req.file.mimetype,
    });

    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(rowToMedia(row, req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Not found' });

    if (row.file_path && fs.existsSync(row.file_path)) {
      fs.unlinkSync(row.file_path);
    }
    db.prepare('DELETE FROM media WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

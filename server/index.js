// Reload env when .env changes (nodemon watches .env)
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { initDatabase } = require('./db');

const path = require('path');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const analyticsRouter = require('./routes/analytics');
const webhookRouter = require('./routes/webhook');
const settingsRouter = require('./routes/settings');
const notificationsRouter = require('./routes/notifications');
const collectionsRouter = require('./routes/collections');
const customersRouter = require('./routes/customers');
const discountsRouter = require('./routes/discounts');
const mediaRouter = require('./routes/media');
const syncLogsRouter = require('./routes/syncLogs');
const authRouter = require('./routes/auth');
const searchRouter = require('./routes/search');
const { shopifyContextMiddleware } = require('./middleware/shopifyContext');

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

initDatabase();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

app.use(
  cors({
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Store-Url', 'X-Shopify-Token', 'Cache-Control', 'Pragma'],
    exposedHeaders: ['Content-Type'],
  })
);

app.use('/webhook', webhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRouter);
app.use('/api', shopifyContextMiddleware);

app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/discounts', discountsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/sync-logs', syncLogsRouter);
app.use('/api/search', searchRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', store: process.env.SHOPIFY_STORE_URL });
});

app.get('/api/sync-status', (_req, res) => {
  const { db } = require('./db');
  const row = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get();
  res.json({ last_sync: row?.value || null });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io };

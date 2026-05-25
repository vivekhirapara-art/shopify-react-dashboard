import { useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import {
  Eye,
  X,
  Ban,
  Search,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  Package,
} from 'lucide-react';
import { api, formatCurrency, timeAgo, parseOrdersResponse } from '../api/client';
import { useApp } from '../components/Layout';
import {
  GlassCard,
  PageHero,
  Pill,
  PillTabs,
  OrderStatusBadge,
  Avatar,
  BTN_PRESS,
  SkeletonRow,
  INPUT_CLASS,
} from '../components/premium-ui';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const FILTER_TABS = ['all', 'pending', 'fulfilled', 'cancelled'];
const DATE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
];

function normalizeStatus(status) {
  return (status || 'pending').toLowerCase();
}

function OrderDetailModal({ order, onClose, onCancel, cancelling }) {
  if (!order) return null;
  const isCancelled = order.status === 'cancelled';
  const steps = [
    { label: 'Placed', done: true },
    { label: 'Processing', done: !isCancelled && order.status !== 'pending' },
    { label: 'Fulfilled', done: order.status === 'fulfilled' || order.status === 'paid' },
  ];
  if (isCancelled) steps[1] = { label: 'Cancelled', done: true };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="modal-panel surface-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border shadow-2xl">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Order #{order.shopify_order_id}</h2>
            <button type="button" onClick={onClose} className={`text-white/80 hover:text-white ${BTN_PRESS}`}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="space-y-5 p-6 text-sm">
          <div className="flex items-center gap-3">
            <Avatar name={order.customer_name} />
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{order.customer_name}</p>
              <p className="text-slate-500">{order.customer_email}</p>
            </div>
          </div>
          <ul className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-slate-800/30">
            {(order.items || []).map((item, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-slate-600 dark:text-slate-300">
                  {item.product_title} × {item.quantity}
                </span>
                <span className="text-slate-400">{formatCurrency(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-slate-200 pt-4 dark:border-slate-700/50">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Total</span>
            <span className="text-lg font-bold text-indigo-400">{formatCurrency(order.total_price)}</span>
          </div>
          <OrderStatusBadge status={order.status} />
          <div className="flex gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`h-2 w-full rounded-full ${s.done ? 'bg-indigo-500' : 'bg-slate-700'}`}
                />
                <span className="text-[10px] text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
          {!isCancelled && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => onCancel(order)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 py-3 font-medium text-red-400 ${BTN_PRESS}`}
            >
              <Ban className="h-4 w-4" />
              {cancelling ? 'Cancelling…' : 'Cancel Order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, count, color }) {
  return (
    <GlassCard className="flex items-center gap-3 p-4" delay={0}>
      <div className={`rounded-xl p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100">{count}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </GlassCard>
  );
}

export default function Orders() {
  const { newOrderIds, addNotification, socketConnected } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const loadOrders = useCallback(async () => {
    try {
      const { data } = await api.get('/api/orders');
      const parsed = parseOrdersResponse(data);
      setOrders(parsed.orders);
      setSyncError(parsed.syncError);
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCancelOrder = async (order) => {
    if (order.status === 'cancelled') return;
    if (!confirm(`Cancel order #${order.shopify_order_id}?`)) return;
    setCancellingId(order.id);
    try {
      const { data } = await api.post(`/api/orders/${order.id}/cancel`);
      const updated = data.order;
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      setSelectedOrder((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
      setFilter('cancelled');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    function upsertOrder(orderData) {
      setOrders((prev) => {
        const exists = prev.some((o) => o.shopify_order_id === orderData.shopify_order_id);
        if (exists) {
          return prev.map((o) =>
            o.shopify_order_id === orderData.shopify_order_id ? { ...o, ...orderData } : o
          );
        }
        return [orderData, ...prev];
      });
    }
    socket.on('new_order', (d) => {
      upsertOrder(d);
      addNotification(d);
    });
    socket.on('order_updated', upsertOrder);
    return () => socket.disconnect();
  }, [addNotification]);

  const counts = useMemo(() => {
    const c = { all: orders.length, pending: 0, fulfilled: 0, cancelled: 0 };
    orders.forEach((o) => {
      const s = normalizeStatus(o.status);
      if (c[s] !== undefined) c[s]++;
    });
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      if (filter !== 'all' && normalizeStatus(o.status) !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !String(o.shopify_order_id).includes(q) &&
          !(o.customer_name || '').toLowerCase().includes(q) &&
          !(o.customer_email || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (dateFilter !== 'all' && o.created_at) {
        const t = new Date(o.created_at).getTime();
        if (dateFilter === 'today' && now - t > 86400000) return false;
        if (dateFilter === '7d' && now - t > 7 * 86400000) return false;
        if (dateFilter === '30d' && now - t > 30 * 86400000) return false;
      }
      return true;
    });
  }, [orders, filter, search, dateFilter]);

  return (
    <div className="space-y-4">
      <PageHero
        title="Orders"
        subtitle="Real-time from Shopify"
        pills={
          <>
            <Pill>
              <ShoppingCart className="h-3 w-3" />
              {orders.length} total
            </Pill>
            {socketConnected && (
              <Pill>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative h-2 w-2 rounded-full bg-red-400" />
                </span>
                Live
              </Pill>
            )}
          </>
        }
      />

      {syncError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {syncError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat icon={ShoppingCart} label="Total" count={counts.all} color="bg-indigo-500/20 text-indigo-400" />
        <MiniStat icon={Clock} label="Pending" count={counts.pending} color="bg-amber-500/20 text-amber-400" />
        <MiniStat icon={CheckCircle} label="Fulfilled" count={counts.fulfilled} color="bg-emerald-500/20 text-emerald-400" />
        <MiniStat icon={XCircle} label="Cancelled" count={counts.cancelled} color="bg-red-500/20 text-red-400" />
      </div>

      <GlassCard className="p-4" delay={200}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search order ID or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full ${INPUT_CLASS} py-2.5 pl-10 pr-4 text-sm`}
            />
          </div>
          <PillTabs tabs={FILTER_TABS} active={filter} onChange={setFilter} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {DATE_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDateFilter(id)}
              className={`rounded-lg px-3 py-1 text-xs ${BTN_PRESS} ${
                dateFilter === id
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden p-0" delay={250}>
        {loading ? (
          <div className="divide-y divide-slate-200 px-4 dark:divide-slate-700/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <th className="px-5 py-4">Order</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Items</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-slate-500">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => (
                    <tr
                      key={order.id || order.shopify_order_id}
                      className={`table-row-hover border-b border-slate-200 dark:border-slate-700/30 ${
                        newOrderIds.has(order.shopify_order_id) ? 'animate-highlight' : ''
                      }`}
                    >
                      <td className="px-5 py-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        #{order.shopify_order_id}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={order.customer_name} size="sm" />
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200">{order.customer_name}</p>
                            <p className="text-xs text-slate-500">{order.customer_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Package className="h-3.5 w-3.5" />
                          {(order.items || []).length}
                          {(order.items || []).length > 3 && ' +more'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(order.total_price)}
                      </td>
                      <td className="px-5 py-4">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {order.created_at ? timeAgo(order.created_at) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className={`rounded-lg border border-slate-600/50 px-2.5 py-1.5 text-xs text-indigo-400 hover:bg-indigo-500/10 ${BTN_PRESS}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {order.status !== 'cancelled' && (
                            <button
                              type="button"
                              disabled={cancellingId === order.id}
                              onClick={() => handleCancelOrder(order)}
                              className={`rounded-lg p-1.5 text-slate-500 hover:text-red-400 ${BTN_PRESS}`}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onCancel={handleCancelOrder}
          cancelling={cancellingId === selectedOrder.id}
        />
      )}
    </div>
  );
}

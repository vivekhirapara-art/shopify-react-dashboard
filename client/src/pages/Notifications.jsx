import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  BellOff,
} from 'lucide-react';
import { api, timeAgo } from '../api/client';
import { Skeleton } from '../components/premium-ui';

const TABS = ['all', 'orders', 'stock alerts', 'system'];
const TAB_TYPES = {
  all: null,
  orders: 'order',
  'stock alerts': 'stock',
  system: 'system',
};

const ICON_MAP = {
  order: { Icon: ShoppingCart, bg: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' },
  stock: { Icon: AlertTriangle, bg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  system: { Icon: CheckCircle2, bg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  error: { Icon: XCircle, bg: 'bg-red-500/20 text-red-600 dark:text-red-400' },
};

function BellSleepSvg() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 text-slate-400 dark:text-slate-600" aria-hidden>
      <path
        fill="currentColor"
        d="M60 8C38 8 20 26 20 48v12L12 76h96l-8-16V48c0-22-18-40-40-40zm0 96a16 16 0 0 0 16-16H44a16 16 0 0 0 16 16z"
        opacity="0.5"
      />
      <text x="72" y="28" fill="currentColor" fontSize="14" fontFamily="sans-serif">
        zzz
      </text>
    </svg>
  );
}

function FilterTabs({ tabs, active, onChange, tabUnread }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={
            active === t
              ? 'rounded-full bg-indigo-600 px-3 py-1.5 text-sm text-white'
              : 'rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700'
          }
        >
          {t}
          {tabUnread[t] > 0 && t !== 'all' ? (
            <span className="ml-1.5 text-xs opacity-80">({tabUnread[t]})</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function ClearAllModal({ onCancel, onConfirm }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Clear all notifications?</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Are you sure you want to delete all notifications? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-100 dark:border-red-500/50 dark:bg-red-900/20 dark:text-red-400"
          >
            Delete All
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/notifications');
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const type = TAB_TYPES[tab];
    if (!type) return items;
    if (type === 'system') return items.filter((n) => n.type === 'system' || n.type === 'error');
    return items.filter((n) => n.type === type);
  }, [items, tab]);

  const tabUnread = useMemo(() => {
    const counts = { all: unread };
    counts.orders = items.filter((n) => n.type === 'order' && !n.read).length;
    counts['stock alerts'] = items.filter((n) => n.type === 'stock' && !n.read).length;
    counts.system = items.filter((n) => (n.type === 'system' || n.type === 'error') && !n.read).length;
    return counts;
  }, [items, unread]);

  async function markRead(id) {
    await api.put(`/api/notifications/${id}/read`);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await api.put('/api/notifications/read-all');
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  async function dismiss(id) {
    await api.delete(`/api/notifications/${id}`);
    const removed = items.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (removed && !removed.read) setUnread((c) => Math.max(0, c - 1));
  }

  async function clearAll() {
    try {
      await api.delete('/api/notifications/all');
      setItems([]);
      setUnread(0);
      setShowClearConfirm(false);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 dark:bg-slate-900">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/50">
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-100/90">Alerts & activity</p>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Notifications</h1>
            </div>
            {unread > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-500/30 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                {unread} unread
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                All caught up
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs tabs={TABS} active={tab} onChange={setTab} tabUnread={tabUnread} />
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) =>
            tabUnread[t] > 0 && t !== 'all' ? (
              <span key={t} className="text-xs text-slate-400 dark:text-slate-500">
                {t}: {tabUnread[t]}
              </span>
            ) : null
          )}
          <button
            type="button"
            onClick={markAllRead}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Mark All Read
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Clear All
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <ClearAllModal onCancel={() => setShowClearConfirm(false)} onConfirm={clearAll} />
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Main list card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {items.length === 0 && (
              <div className="mb-4">
                <BellSleepSvg />
              </div>
            )}
            <BellOff className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {items.length === 0 ? 'No notifications found' : 'All caught up! No notifications.'}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              New orders and alerts will appear here
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((n) => {
              const cfg = ICON_MAP[n.type] || ICON_MAP.system;
              const { Icon } = cfg;
              const isUnread = !n.read;

              return (
                <li
                  key={n.id}
                  className={`flex cursor-pointer items-start gap-4 border-b border-slate-100 bg-white p-4 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-transparent dark:hover:bg-slate-700/30 ${
                    isUnread
                      ? 'border-l-2 border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
                      : ''
                  }`}
                  onClick={() => isUnread && markRead(n.id)}
                  onKeyDown={(e) => e.key === 'Enter' && isUnread && markRead(n.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{n.message}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{timeAgo(n.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    {isUnread && (
                      <span className="mt-2 h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(n.id);
                      }}
                      className="rounded-lg p-1 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-300"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

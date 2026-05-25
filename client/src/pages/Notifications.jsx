import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  BellOff,
} from 'lucide-react';
import { api, timeAgo } from '../api/client';
import {
  PageHero,
  GlassCard,
  Pill,
  PillTabs,
  BTN_PRESS,
  Skeleton,
  EmptyState,
} from '../components/premium-ui';

const TABS = ['all', 'orders', 'stock alerts', 'system'];
const TAB_TYPES = {
  all: null,
  orders: 'order',
  'stock alerts': 'stock',
  system: 'system',
};

const ICON_MAP = {
  order: { Icon: ShoppingCart, bg: 'bg-blue-500/20 text-blue-400' },
  stock: { Icon: AlertTriangle, bg: 'bg-amber-500/20 text-amber-400' },
  system: { Icon: CheckCircle2, bg: 'bg-emerald-500/20 text-emerald-400' },
  error: { Icon: XCircle, bg: 'bg-red-500/20 text-red-400' },
};

function BellSleepSvg() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 text-slate-600" aria-hidden>
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
    <div className="space-y-6">
      <PageHero
        title="Notifications"
        pills={
          unread > 0 ? (
            <Pill className="bg-red-500/30">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              {unread} unread
            </Pill>
          ) : (
            <Pill>All caught up</Pill>
          )
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PillTabs tabs={TABS} active={tab} onChange={setTab} />
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) =>
            tabUnread[t] > 0 && t !== 'all' ? (
              <span key={t} className="hidden text-xs text-slate-500 sm:inline">
                {t}: {tabUnread[t]}
              </span>
            ) : null
          )}
          <button
            type="button"
            onClick={markAllRead}
            className={`rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:text-indigo-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:text-white ${BTN_PRESS}`}
          >
            Mark All Read
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className={`rounded-xl border border-red-500 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 ${BTN_PRESS}`}
          >
            🗑 Clear All
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="page-fade-in w-full max-w-sm rounded-2xl border border-slate-200 bg-white dark:border-slate-700/50 dark:bg-slate-800 p-6 shadow-xl">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to delete all notifications? This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className={`rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 ${BTN_PRESS}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearAll}
                className={`rounded-xl border border-red-500 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 ${BTN_PRESS}`}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <GlassCard delay={100} className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8">
            {items.length === 0 && (
              <div className="mb-4 flex justify-center">
                <BellSleepSvg />
              </div>
            )}
            <EmptyState
              icon={BellOff}
              title={items.length === 0 ? 'No notifications found' : 'All caught up! No notifications.'}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {filtered.map((n, i) => {
              const cfg = ICON_MAP[n.type] || ICON_MAP.system;
              const { Icon } = cfg;
              return (
                <li
                  key={n.id}
                  className={`page-fade-in flex cursor-pointer gap-4 px-5 py-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/20 ${
                    !n.read ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-transparent'
                  }`}
                  style={{ animationDelay: `${100 + i * 50}ms` }}
                  onClick={() => !n.read && markRead(n.id)}
                  onKeyDown={(e) => e.key === 'Enter' && !n.read && markRead(n.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-500">{timeAgo(n.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    {!n.read && <span className="mt-2 h-2.5 w-2.5 rounded-full bg-indigo-500" />}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(n.id);
                      }}
                      className={`rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700/50 dark:hover:text-slate-300 ${BTN_PRESS}`}
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
      </GlassCard>
    </div>
  );
}

import { useEffect } from 'react';
import { X, ShoppingCart, Bell, CheckCheck } from 'lucide-react';
import { formatCurrency, timeAgo } from '../api/client';
import { CARD, BTN_PRESS } from './premium-ui';

export function Toast({ notification, onClose }) {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 slide-up-bar rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-indigo-500/20 backdrop-blur-md dark:border-slate-600/60 dark:bg-slate-900/95">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">New Order</p>
            <p className="text-sm text-slate-400">{notification.customer_name || 'Guest'}</p>
            <p className="text-sm font-medium text-indigo-400">
              {formatCurrency(notification.total_price)}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className={`text-slate-500 hover:text-slate-300 ${BTN_PRESS}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function NotificationDropdown({ notifications, isOpen, onToggle, unreadCount, onMarkAllRead }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:border-indigo-500/40 hover:text-indigo-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-indigo-300 ${BTN_PRESS}`}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="badge-bounce absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40" onClick={onToggle} aria-hidden />
          <div className={`absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl ${CARD} shadow-2xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700/50">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Notifications</span>
              {notifications.length > 0 && onMarkAllRead && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className={`flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 ${BTN_PRESS}`}
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {notifications.slice(0, 8).map((n, i) => (
                  <li
                    key={n.shopify_order_id || i}
                    className="border-b border-slate-200 px-4 py-3 last:border-0 transition-colors hover:bg-slate-50 dark:border-slate-700/30 dark:hover:bg-slate-800/50"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.customer_name || 'Guest'}</p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(n.total_price)} · #{n.shopify_order_id}
                    </p>
                    {n.created_at && (
                      <p className="mt-0.5 text-[10px] text-slate-600">{timeAgo(n.created_at)}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

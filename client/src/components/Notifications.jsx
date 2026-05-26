import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ShoppingCart,
  Bell,
  CheckCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { timeAgo } from '../api/client';
import { CARD, BTN_PRESS } from './premium-ui';

const TYPE_ICONS = {
  order: { Icon: ShoppingCart, bg: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' },
  stock: { Icon: AlertTriangle, bg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  system: { Icon: CheckCircle2, bg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  error: { Icon: XCircle, bg: 'bg-red-500/20 text-red-600 dark:text-red-400' },
};

function getNotificationMeta(notification) {
  const type = (notification?.type || 'system').toLowerCase();
  return TYPE_ICONS[type] || { Icon: Bell, bg: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' };
}

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
          </div>
        </div>
        <button type="button" onClick={onClose} className={`text-slate-500 hover:text-slate-300 ${BTN_PRESS}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function NotificationDropdown({
  notifications,
  isOpen,
  onToggle,
  unreadCount,
  onMarkAllRead,
}) {
  const navigate = useNavigate();
  const dropdownItems = notifications.slice(0, 5);

  function openNotificationsPage() {
    onToggle();
    navigate('/notifications');
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className={`rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:border-indigo-500/40 hover:text-indigo-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-indigo-300 ${BTN_PRESS}`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <div className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
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
                  className={`flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 ${BTN_PRESS}`}
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            {dropdownItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No notifications yet
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {dropdownItems.map((n) => {
                  const { Icon, bg } = getNotificationMeta(n);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={openNotificationsPage}
                        className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-700/30 dark:hover:bg-slate-800/50 ${
                          !n.read ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                        } ${BTN_PRESS}`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {n.title || 'Notification'}
                          </p>
                          {n.message && (
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                          )}
                          {n.created_at && (
                            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                              {timeAgo(n.created_at)}
                            </p>
                          )}
                        </div>
                        {!n.read && (
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {notifications.length > 5 && (
              <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={openNotificationsPage}
                  className={`w-full py-2 text-center text-xs font-medium text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 ${BTN_PRESS}`}
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

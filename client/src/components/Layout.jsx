import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Home,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  Clock,
  Bell,
  LayoutGrid,
  Users,
  Tag,
  Image,
  RefreshCw,
  Menu,
  X,
  HelpCircle,
} from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import { api, timeAgo } from '../api/client';
import { AUTO_SYNC_INTERVAL_MS, isAutoSyncEnabled } from '../lib/syncConfig';
import { BTN_PRESS } from './premium-ui';
import { NotificationDropdown } from './Notifications';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import { clearAppCache } from '../utils/api';
import ConnectStoreForm from './ConnectStoreForm';
import PageWrapper from './PageWrapper';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function parseNotificationsResponse(data) {
  if (Array.isArray(data)) return data;
  return data?.notifications ?? [];
}

export const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within Layout');
  return ctx;
}

const navGroups = [
  {
    label: 'Main',
    items: [
      { to: '/', label: 'Dashboard', icon: Home },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/orders', label: 'Orders', icon: ShoppingCart },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Store',
    items: [
      { to: '/collections', label: 'Collections', icon: LayoutGrid },
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/discounts', label: 'Discounts', icon: Tag },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/media', label: 'Media Library', icon: Image },
      { to: '/sync-logs', label: 'Sync Logs', icon: RefreshCw },
      { to: '/about', label: 'Help & About', icon: HelpCircle },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const pageTitles = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/orders': 'Orders',
  '/analytics': 'Analytics',
  '/notifications': 'Notifications',
  '/collections': 'Collections',
  '/customers': 'Customers',
  '/discounts': 'Discounts',
  '/media': 'Media Library',
  '/sync-logs': 'Sync Logs',
  '/settings': 'Settings',
  '/about': 'Help & About',
};

function SidebarNav({ onNavigate }) {
  return (
    <>
      {navGroups.map((group) => (
        <div key={group.label} className="mb-4">
          <p className="nav-group-label mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `nav-item group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium ${BTN_PRESS} ${
                    isActive
                      ? 'border-l-2 border-indigo-500 bg-indigo-50 text-indigo-600 shadow-inner shadow-indigo-500/10 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'border-l-2 border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const storeName = user?.storeName || user?.storeUrl?.split('.')[0] || 'Store';
  const storeInitial = (storeName[0] || 'S').toUpperCase();
  const [lastSync, setLastSync] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );
  const { isDark, toggleTheme } = useTheme();
  const { toast: showToast } = useToast();
  const [newOrderIds, setNewOrderIds] = useState(new Set());
  const [socketConnected, setSocketConnected] = useState(false);
  const [autoSync, setAutoSync] = useState(isAutoSyncEnabled);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarSpinning, setAvatarSpinning] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [logoutToast, setLogoutToast] = useState(null);

  function handleStoreRefresh() {
    setAvatarSpinning(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  }

  const fetchSyncStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/api/sync-status');
      setLastSync(data.last_sync);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/api/notifications');
      setNotifications(parseNotificationsResponse(data));
    } catch (err) {
      console.error('Notifications fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    fetchSyncStatus();
    fetchNotifications();
    const syncInterval = setInterval(fetchSyncStatus, 60000);
    const notifInterval = setInterval(fetchNotifications, 30000);
    return () => {
      clearInterval(syncInterval);
      clearInterval(notifInterval);
    };
  }, [fetchSyncStatus, fetchNotifications]);

  useEffect(() => {
    const onAutoSyncChange = () => setAutoSync(isAutoSyncEnabled());
    window.addEventListener('auto-sync-changed', onAutoSyncChange);
    return () => window.removeEventListener('auto-sync-changed', onAutoSyncChange);
  }, []);

  useEffect(() => {
    if (!autoSync) return undefined;
    async function runProductSync() {
      try {
        const { data } = await api.post('/api/settings/sync-products', { type: 'auto' });
        setLastSync(data.last_sync);
        fetchNotifications();
      } catch {
        /* silent */
      }
    }
    runProductSync();
    const id = setInterval(runProductSync, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoSync, fetchNotifications]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('new_order', (orderData) => {
      showToast(
        'success',
        'New Order',
        `${orderData.customer_name || 'Guest'} — ${orderData.total_price ? `$${orderData.total_price}` : 'received'}`
      );
      fetchNotifications();
      setNewOrderIds((prev) => new Set(prev).add(orderData.shopify_order_id));
      setTimeout(() => {
        setNewOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderData.shopify_order_id);
          return next;
        });
      }, 3000);
    });

    return () => socket.disconnect();
  }, [fetchNotifications, showToast]);

  function handleLogoutConfirm() {
    logout();
    setLogoutOpen(false);
    showToast('info', 'Disconnected', 'Store disconnected successfully');
    navigate('/login', { replace: true });
  }

  function handleSwitchSuccess() {
    clearAppCache();
    setSwitchOpen(false);
    setNotifications([]);
    window.location.href = '/';
  }

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
    setDropdownOpen(false);
  };

  const pageTitle = pageTitles[location.pathname] || location.pathname.slice(1);

  const contextValue = {
    lastSync,
    setLastSync,
    fetchSyncStatus,
    notifications,
    newOrderIds,
    socketConnected,
    fetchNotifications,
    addNotification: () => {
      fetchNotifications();
    },
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="surface-page flex min-h-screen transition-colors duration-300">
        <button
          type="button"
          className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden ${
            mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-label="Close menu"
          aria-hidden={!mobileOpen}
          tabIndex={mobileOpen ? 0 : -1}
          onClick={() => setMobileOpen(false)}
        />

        <aside
          className={`surface-sidebar fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r transition-transform duration-300 ease-out lg:translate-x-0 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleStoreRefresh}
                title="Click to refresh"
                aria-label="Click to refresh"
                className={`avatar-glow-ring flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-lg font-bold text-white transition-all duration-200 hover:scale-105 hover:opacity-80 ${
                  avatarSpinning ? 'avatar-refresh-spin' : ''
                }`}
              >
                {storeInitial}
              </button>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{storeName}</p>
                <p className="text-xs text-slate-500">Shopify Store</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-slate-400 lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </nav>
          <div className="border-t border-slate-200 p-4 dark:border-slate-700/50">
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-transparent dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-sm font-bold text-white">
                  {storeInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{storeName}</p>
                  <p className="truncate text-xs text-slate-500">{user?.storeUrl}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSwitchOpen(true)}
                className={`mt-2 w-full text-left text-xs text-slate-500 hover:text-indigo-400 ${BTN_PRESS}`}
              >
                Switch Store
              </button>
            </div>
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 ${BTN_PRESS}`}
              onClick={() => setLogoutOpen(true)}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
          <header className="surface-nav sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 sm:px-8 sm:py-4">
            <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3 lg:flex-1">
              {/* Mobile: menu + store identity */}
              <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
                <button
                  type="button"
                  className={`shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 ${BTN_PRESS}`}
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleStoreRefresh}
                  title="Click to refresh"
                  aria-label="Click to refresh"
                  className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left transition-all duration-200 hover:opacity-80 ${BTN_PRESS}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-xs font-bold text-white transition-all duration-200 hover:scale-105 ${
                      avatarSpinning ? 'avatar-refresh-spin-fast' : ''
                    }`}
                  >
                    {storeInitial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{storeName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Shopify Store</p>
                  </div>
                </button>
              </div>
              {/* Desktop: page title */}
              <h1 className="hidden truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 lg:block">
                {pageTitle}
              </h1>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <GlobalSearch />
              <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 md:flex">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {lastSync ? timeAgo(lastSync) : 'Never synced'}
              </span>
              <NotificationDropdown
                notifications={notifications}
                isOpen={dropdownOpen}
                onToggle={() => {
                  if (!dropdownOpen) fetchNotifications();
                  setDropdownOpen((open) => !open);
                }}
                unreadCount={unreadCount}
                onMarkAllRead={markAllRead}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleTheme();
                }}
                className={`relative z-30 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-indigo-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-indigo-300 ${BTN_PRESS}`}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Light mode' : 'Dark mode'}
                aria-pressed={isDark}
              >
                <span key={isDark ? 'sun' : 'moon'} className="theme-icon-enter inline-flex">
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </span>
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <PageWrapper>
              <Outlet />
            </PageWrapper>
          </main>
        </div>
      </div>

      {logoutOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-panel surface-card w-full max-w-sm rounded-2xl border p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Disconnect Store?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              You will need your Access Token to reconnect.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLogoutOpen(false)}
                className={`rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 ${BTN_PRESS}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogoutConfirm}
                className={`rounded-xl border border-red-500 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 ${BTN_PRESS}`}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {switchOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-panel surface-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Switch to a different store</h3>
              <button type="button" onClick={() => setSwitchOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ConnectStoreForm
              compact
              showHelp={false}
              showHistory
              submitLabel="Connect Store"
              onSuccess={handleSwitchSuccess}
            />
          </div>
        </div>
      )}

    </AppContext.Provider>
  );
}

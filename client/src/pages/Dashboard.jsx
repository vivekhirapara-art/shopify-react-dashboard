import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Package,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Package2,
  Plus,
  RefreshCw,
  Upload,
  Bell,
  BarChart3,
  Calendar,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import {
  api,
  formatCurrency,
  formatInventoryValue,
  getProductImageSrc,
  dedupeByKey,
  timeAgo,
  parseOrdersResponse,
} from '../api/client';
import { useApp } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import {
  GlassCard,
  PageHero,
  StatCard,
  ChartTooltip,
  Pill,
  OrderStatusBadge,
  Avatar,
  ViewAllLink,
  getGreeting,
  BTN_PRESS,
  SkeletonCard,
} from '../components/premium-ui';

const STOCK_COLORS = ['#3b82f6', '#f59e0b', '#ef4444'];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const QUICK_ACTIONS = [
  { label: 'Add Product', icon: Plus, to: '/products', action: 'nav' },
  { label: 'Sync Now', icon: RefreshCw, action: 'sync' },
  { label: 'Export CSV', icon: Upload, action: 'export' },
  { label: 'View Notifications', icon: Bell, to: '/notifications', action: 'nav' },
  { label: 'Full Analytics', icon: BarChart3, to: '/analytics', action: 'nav' },
];

const ACTIVITY_ICONS = {
  order: { Icon: ShoppingCart, bg: 'bg-blue-500/20 text-blue-400' },
  stock: { Icon: AlertTriangle, bg: 'bg-amber-500/20 text-amber-400' },
  system: { Icon: CheckCircle2, bg: 'bg-emerald-500/20 text-emerald-400' },
  error: { Icon: XCircle, bg: 'bg-red-500/20 text-red-400' },
};

function MiniSparkline({ data, color = '#6366f1' }) {
  if (!data?.length) return <div className="h-8" />;
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function OrdersBarShape(props) {
  const { x, y, width, height } = props;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="url(#ordersBarGradient)"
      rx={6}
      ry={6}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800/50" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800/50" />
      <div className="grid gap-4 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800/50" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800/50 lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800/50" />
      </div>
    </div>
  );
}

async function fetchWithRetry(requestFn, attempts = 3, delayMs = 500) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await requestFn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, delayMs * (attempt + 1));
        });
      }
    }
  }
  throw lastError;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isChecking } = useAuth();
  const { isDark } = useTheme();
  const chartGrid = isDark ? '#334155' : '#e2e8f0';
  const chartAxis = '#64748b';
  const { fetchSyncStatus, setLastSync } = useApp();
  const storeName = user?.storeName || user?.storeUrl?.split('.')[0] || 'Store';
  const [analytics, setAnalytics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [webhooksActive, setWebhooksActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const SOCKET_CONFIG = { path: '/socket.io', transports: ['polling'], upgrade: false };

  const loadDashboard = useCallback(async () => {
    if (!user?.storeUrl || !user?.accessToken) return;

    setLoading(true);
    setDataReady(false);
    try {
      const [analyticsRes, ordersRes, notifRes, webhooksRes] = await fetchWithRetry(() =>
        Promise.all([
          api.get('/api/analytics'),
          api.get('/api/orders'),
          api.get('/api/notifications').catch(() => ({ data: { notifications: [] } })),
          api.get('/api/settings/webhooks-status').catch(() => ({ data: { webhooks: [] } })),
        ])
      );

      const analyticsData = analyticsRes.data;
      setAnalytics(analyticsData);

      const parsed = dedupeByKey(parseOrdersResponse(ordersRes.data).orders, (o) =>
        String(o.shopify_order_id || o.id)
      );
      setAllOrders(parsed);
      const activeOrders = parsed.filter(
        (o) => String(o.status || '').toLowerCase() !== 'cancelled'
      );
      setOrders((activeOrders.length ? activeOrders : parsed).slice(0, 5));

      setLowStock(
        dedupeByKey(analyticsData.low_stock_products || [], (p) => String(p.shopify_id || p.id))
      );

      const notifs = notifRes.data?.notifications ?? notifRes.data ?? [];
      setNotifications(
        dedupeByKey(Array.isArray(notifs) ? notifs : [], (n) => String(n.id)).slice(0, 10)
      );

      const hooks = webhooksRes.data.webhooks || [];
      setWebhooksActive(hooks.some((w) => w.active));
      setDataReady(true);
    } catch (err) {
      // Avoid noisy console errors for transient API failures on mobile/ngrok.
      setDataReady(false);
    } finally {
      setLoading(false);
    }
  }, [user?.storeUrl, user?.accessToken]);

  // Wait until auth bootstrap finishes, then load with credentials on headers
  useEffect(() => {
    if (isChecking) return;
    if (!user?.storeUrl || !user?.accessToken) {
      setLoading(false);
      return;
    }
    loadDashboard();
  }, [isChecking, user?.storeUrl, user?.accessToken, loadDashboard]);

  // Refetch when navigating back to Dashboard (e.g. from Products)
  useEffect(() => {
    if (location.pathname !== '/' || isChecking) return;
    if (!user?.storeUrl || !user?.accessToken) return;
    loadDashboard();
  }, [location.pathname, location.key, isChecking, user?.storeUrl, user?.accessToken, loadDashboard]);

  // Refetch when tab becomes visible again
  useEffect(() => {
    function onVisibilityChange() {
      if (
        document.visibilityState === 'visible' &&
        location.pathname === '/' &&
        user?.storeUrl &&
        user?.accessToken
      ) {
        loadDashboard();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [location.pathname, user?.storeUrl, user?.accessToken, loadDashboard]);

  // Auto-refresh dashboard every 30 seconds when visible on Dashboard
  useEffect(() => {
    if (location.pathname !== '/' || isChecking) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!user?.storeUrl || !user?.accessToken) return;
      loadDashboard();
    }, 30000);
    return () => clearInterval(id);
  }, [location.pathname, isChecking, user?.storeUrl, user?.accessToken, loadDashboard]);

  // Refresh immediately when server emits a new order
  useEffect(() => {
    const socket = io(SOCKET_CONFIG);
    socket.on('new_order', () => {
      if (location.pathname !== '/') return;
      loadDashboard();
    });
    return () => socket.disconnect();
  }, [location.pathname, loadDashboard]);

  async function handleSync() {
    setSyncing(true);
    try {
      const { data } = await api.post('/api/settings/sync-products', { type: 'manual' });
      setLastSync(data.last_sync);
      fetchSyncStatus();
      await loadDashboard();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setSyncing(false);
    }
  }

  function handleExportCsv() {
    window.location.href = `${API_BASE}/api/products/export-csv`;
  }

  function handleQuickAction(action) {
    if (action.action === 'nav' && action.to) navigate(action.to);
    if (action.action === 'sync') handleSync();
    if (action.action === 'export') handleExportCsv();
  }

  const activityFeed = useMemo(() => {
    const items = [];

    notifications.slice(0, 5).forEach((n) => {
      items.push({
        id: `n-${n.id}`,
        type: n.type,
        text: n.title + (n.message ? ` — ${n.message}` : ''),
        time: n.created_at,
      });
    });

    allOrders.slice(0, 3).forEach((o) => {
      items.push({
        id: `o-${o.shopify_order_id || o.id}`,
        type: 'order',
        text: `New order #${o.shopify_order_id} — ${o.customer_name} — ${formatCurrency(o.total_price)}`,
        time: o.created_at,
      });
    });

    lowStock.slice(0, 2).forEach((p) => {
      items.push({
        id: `s-${p.shopify_id || p.id}`,
        type: 'stock',
        text: `Low stock alert — ${p.title} (${p.stock} left)`,
        time: null,
      });
    });

    const unique = dedupeByKey(items, (item) => item.id);

    return unique
      .sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return new Date(b.time) - new Date(a.time);
      })
      .slice(0, 6);
  }, [notifications, allOrders, lowStock]);

  const healthScore = useMemo(() => {
    let score = 100;
    const low = analytics?.low_stock ?? 0;
    score -= Math.min(low * 5, 15);
    if (!webhooksActive) score -= 15;
    return Math.max(0, Math.min(100, score));
  }, [analytics, webhooksActive]);

  const healthColor =
    healthScore > 80 ? 'text-emerald-400' : healthScore >= 50 ? 'text-amber-400' : 'text-red-400';
  const healthStroke =
    healthScore > 80 ? '#34d399' : healthScore >= 50 ? '#fbbf24' : '#f87171';
  const healthOffset = 2 * Math.PI * 42 * (1 - healthScore / 100);

  if (loading || isChecking || !dataReady) {
    return <DashboardSkeleton />;
  }

  const chartData = analytics?.sales_last_30_days || [];
  const stockData = analytics?.stock_distribution
    ? [
        { name: 'In Stock', value: analytics.stock_distribution.in_stock },
        { name: 'Low', value: analytics.stock_distribution.low },
        { name: 'Out', value: analytics.stock_distribution.out },
      ]
    : [];
  const ordersChartData = analytics?.orders_last_14_days || [];
  const topProducts = analytics?.top_products_by_value || [];
  const maxProductValue = topProducts[0]?.total_value || 1;
  const todaySummary = analytics?.today_summary;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const heroDate = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const lowCount = analytics?.low_stock ?? 0;
  const inventoryDisplay =
    analytics?.inventory_value ??
    formatInventoryValue(analytics?.inventory_value_raw ?? 0);

  return (
    <div className="space-y-4">
      <PageHero
        title={`${getGreeting()} 👋`}
        subtitle={storeName}
        pills={
          <>
            <Pill>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live
            </Pill>
            <Pill>
              <Package2 className="h-3 w-3" />
              {analytics?.total_products ?? 0} Products
            </Pill>
            <Pill>{heroDate}</Pill>
          </>
        }
      />

      <div
        className="page-fade-in -mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
        style={{ animationDelay: '80ms' }}
      >
        {QUICK_ACTIONS.map(({ label, icon: Icon, action, to }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleQuickAction({ action, to })}
            disabled={action === 'sync' && syncing}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 backdrop-blur-sm transition-all hover:border-indigo-500/40 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800/80 ${BTN_PRESS}`}
          >
            <Icon className={`h-4 w-4 text-indigo-400 ${action === 'sync' && syncing ? 'animate-spin' : ''}`} />
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Package}
          label="Total Products"
          value={analytics?.total_products ?? 0}
          iconClass="bg-indigo-500/20 text-indigo-400"
          trend={{ up: true, text: '+12% ↑' }}
          delay={100}
        />
        <StatCard
          icon={DollarSign}
          label="Inventory Value"
          displayValue={inventoryDisplay}
          value={0}
          iconClass="bg-emerald-500/20 text-emerald-400"
          trend={{ up: true, text: '+8% ↑' }}
          delay={150}
        />
        <StatCard
          icon={ShoppingCart}
          label="Total Orders"
          value={analytics?.total_orders ?? 0}
          iconClass="bg-purple-500/20 text-purple-400"
          trend={{ up: true, text: '+5% ↑' }}
          delay={200}
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock"
          value={lowCount}
          iconClass="bg-amber-500/20 text-amber-400"
          trend={lowCount > 0 ? { up: false, text: `${lowCount} alert` } : { up: true, text: 'OK' }}
          delay={250}
          pulse={lowCount > 0}
        />
      </div>

      <GlassCard className="overflow-hidden p-0" delay={280} borderTop="from-indigo-600 to-indigo-400">
        <div className="border-l-4 border-indigo-500 bg-slate-800/30 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
            <Calendar className="h-4 w-4 text-indigo-400" />
            <span>
              Today: <span className="font-medium text-slate-800 dark:text-slate-200">{todayLabel}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Orders Today</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{todaySummary?.orders_today ?? 0}</p>
              <MiniSparkline data={todaySummary?.orders_sparkline} color="#818cf8" />
            </div>
            <div className="border-slate-200 dark:border-slate-700/50 sm:border-x sm:px-6">
              <p className="text-xs uppercase tracking-wide text-slate-500">Revenue Today</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">
                {formatCurrency(todaySummary?.revenue_today ?? 0)}
              </p>
              <MiniSparkline data={todaySummary?.revenue_sparkline} color="#34d399" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">New Customers</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {todaySummary?.new_customers_today ?? 0}
              </p>
              <MiniSparkline data={todaySummary?.customers_sparkline} color="#a78bfa" />
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <GlassCard className="p-5" delay={300} borderTop="from-indigo-600 to-indigo-400">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">Sales Last 30 Days</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke={chartAxis}
                tick={{ fontSize: 11, fill: chartAxis }}
                interval="preserveStartEnd"
                tickFormatter={(v) => v?.slice(5)}
              />
              <YAxis
                stroke={chartAxis}
                width={70}
                domain={[
                  0,
                  (dataMax) => {
                    const values = chartData.map((d) => d.revenue || 0);
                    const average = values.length
                      ? values.reduce((a, b) => a + b, 0) / values.length
                      : 0;
                    const capped = average > 0 ? Math.min(dataMax, average * 3) : dataMax || 1;
                    // Add headroom so line isn't glued to the top.
                    const top = capped > 0 ? capped * 1.2 : 1;
                    // Prevent tiny ranges that render as all "$0" ticks.
                    if (top < 10) return 10;
                    if (top < 100) return Math.ceil(top);
                    return top;
                  },
                ]}
                allowDecimals
                tick={{ fontSize: 11, fill: chartAxis }}
                tickFormatter={(v) => {
                  const n = Number(v) || 0;
                  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
                  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
                  if (n > 0 && n < 10) return `$${n.toFixed(2)}`;
                  return `$${n.toFixed(0)}`;
                }}
              />
              <Tooltip content={<ChartTooltip formatter={(v) => formatCurrency(v)} />} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5" delay={350} borderTop="from-purple-600 to-purple-400">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">Stock Distribution</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stockData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} opacity={0.5} />
              <XAxis dataKey="name" stroke={chartAxis} tick={{ fontSize: 11, fill: chartAxis }} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11, fill: chartAxis }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {stockData.map((entry, i) => (
                  <Cell key={entry.name} fill={STOCK_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5" delay={400} borderTop="from-indigo-600 to-purple-600">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Orders This Month</h2>
            <span className="text-sm font-bold text-indigo-400">
              {analytics?.orders_this_month ?? 0} total
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ordersChartData}>
              <defs>
                <linearGradient id="ordersBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} opacity={0.5} />
              <XAxis dataKey="date" stroke={chartAxis} tick={{ fontSize: 10, fill: chartAxis }} tickFormatter={(v) => v?.slice(8)} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11, fill: chartAxis }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" shape={<OrdersBarShape />} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2" delay={450}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Top Products by Value</h2>
            <ViewAllLink to="/products" />
          </div>
          {topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No products yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700/50">
                    <th className="pb-2 pr-3">Rank</th>
                    <th className="pb-2 pr-3">Image</th>
                    <th className="pb-2 pr-3">Product</th>
                    <th className="pb-2 pr-3">Price</th>
                    <th className="pb-2 pr-3">Stock</th>
                    <th className="pb-2">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr
                      key={p.shopify_id || p.title}
                      className="border-b border-slate-200 hover:bg-slate-50 dark:border-slate-700/30 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-3 pr-3 font-medium text-indigo-400">#{i + 1}</td>
                      <td className="py-3 pr-3">
                        {getProductImageSrc(p.image) ? (
                          <img
                            src={getProductImageSrc(p.image)}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-xs text-white">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                      </td>
                      <td className="max-w-[140px] truncate py-3 pr-3 font-medium text-slate-800 dark:text-slate-200">{p.title}</td>
                      <td className="py-3 pr-3 text-indigo-300">{formatCurrency(p.price)}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            p.stock > 10
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : p.stock > 0
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatInventoryValue(p.total_value)}
                          </span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${(p.total_value / maxProductValue) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 text-center">
            <Link to="/products" className={`text-sm text-indigo-400 hover:text-indigo-300 ${BTN_PRESS}`}>
              View All Products →
            </Link>
          </div>
        </GlassCard>

        <GlassCard className="p-5" delay={500}>
          <h2 className="mb-4 text-center font-semibold text-slate-900 dark:text-slate-100">Store Health</h2>
          <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
            <svg className="-rotate-90" width="128" height="128" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke={chartGrid} strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={healthStroke}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={healthOffset}
                className="transition-all duration-700"
              />
            </svg>
            <span className={`absolute text-2xl font-bold ${healthColor}`}>{healthScore}%</span>
          </div>
          <ul className="mt-4 space-y-2 text-xs">
            <li className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> All systems connected
            </li>
            <li className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Products synced
            </li>
            <li className={`flex items-center gap-2 ${lowCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {lowCount > 0 ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              )}
              {lowCount > 0 ? `${lowCount} low stock items` : 'Stock levels healthy'}
            </li>
            <li className={`flex items-center gap-2 ${webhooksActive ? 'text-emerald-400' : 'text-amber-400'}`}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Webhooks {webhooksActive ? 'active' : 'pending'}
            </li>
          </ul>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard className="p-5" delay={550}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Recent Orders</h2>
            <ViewAllLink to="/orders" />
          </div>
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No orders yet</p>
          ) : (
            <ul className="space-y-2">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-indigo-500/30 dark:border-slate-700/40 dark:bg-slate-900/30 dark:hover:bg-slate-800/50"
                >
                  <Avatar name={order.customer_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{order.customer_name}</p>
                    <p className="text-xs text-slate-500">
                      {(order.items || []).length} items · #{order.shopify_order_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(order.total_price)}</p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="p-5" delay={600}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <Activity className="h-4 w-4 text-indigo-400" />
                Recent Activity
              </h2>
            </div>
            {activityFeed.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No recent activity</p>
            ) : (
              <ul>
                {activityFeed.map((item, idx) => {
                  const cfg = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.system;
                  const { Icon } = cfg;
                  return (
                    <li
                      key={item.id}
                      className={`flex gap-3 py-3 ${idx < activityFeed.length - 1 ? 'border-b border-slate-200 dark:border-slate-700/40' : ''}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">{item.text}</p>
                      <span className="shrink-0 text-xs text-slate-500">
                        {item.time ? timeAgo(item.time) : '—'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-3 border-t border-slate-200 pt-3 text-center dark:border-slate-700/50">
              <Link
                to="/sync-logs"
                className={`text-sm font-medium text-indigo-400 hover:text-indigo-300 ${BTN_PRESS}`}
              >
                View All Activity →
              </Link>
            </div>
          </GlassCard>

          <GlassCard className="p-5" delay={650}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Low Stock Alert</h2>
              {lowCount > 0 && (
                <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-400">
                  {lowCount}
                </span>
              )}
            </div>
            {lowStock.length === 0 ? (
              <p className="py-8 text-center text-sm text-emerald-400">✅ All products well stocked</p>
            ) : (
              <ul className="space-y-2">
                {lowStock.slice(0, 6).map((p) => (
                  <li
                    key={p.shopify_id || p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700/40 dark:bg-slate-900/30"
                  >
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">{p.title}</p>
                    <span className="shrink-0 font-bold text-red-400">{p.stock}</span>
                    <Link
                      to="/products"
                      className={`shrink-0 rounded-lg border border-slate-600/50 px-2 py-1 text-[10px] text-slate-400 hover:text-indigo-300 ${BTN_PRESS}`}
                    >
                      Update
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

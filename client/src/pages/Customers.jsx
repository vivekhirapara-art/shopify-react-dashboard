import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Search, X, Mail, MapPin, Phone } from 'lucide-react';
import { api, formatCurrency, timeAgo } from '../api/client';
import {
  PageHero,
  GlassCard,
  StatCard,
  Pill,
  BTN_PRESS,
  Skeleton,
  EmptyState,
  OrderStatusBadge,
} from '../components/premium-ui';

const AVATAR_COLORS = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌍';
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

function avatarColor(name) {
  const i = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    newThisMonth: 0,
    repeatBuyers: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/customers');
      setCustomers(data.customers || []);
      setStats(data.stats || { total: 0, newThisMonth: 0, repeatBuyers: 0, totalRevenue: 0 });
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
    let list = [...customers];
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sort === 'spent') return b.total_spent - a.total_spent;
      if (sort === 'orders') return b.orders_count - a.orders_count;
      if (sort === 'recent') return new Date(b.last_order_at || 0) - new Date(a.last_order_at || 0);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [customers, search, sort]);

  async function openDetail(c) {
    setSelected(c);
    setOrdersLoading(true);
    try {
      const { data } = await api.get(`/api/customers/${c.id}/orders`);
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  const tagColors = {
    VIP: 'bg-amber-500/20 text-amber-400',
    Regular: 'bg-indigo-500/20 text-indigo-400',
    New: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <div className="space-y-6">
      <PageHero title="Customers" pills={<Pill>{stats.total} customers</Pill>} />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {typeof error === 'object' ? JSON.stringify(error) : error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Customers" value={stats.total} iconClass="bg-indigo-500/20 text-indigo-400" delay={0} />
        <StatCard icon={Users} label="New This Month" value={stats.newThisMonth} iconClass="bg-emerald-500/20 text-emerald-400" delay={100} />
        <StatCard icon={Users} label="Repeat Buyers" value={stats.repeatBuyers} iconClass="bg-purple-500/20 text-purple-400" delay={200} />
        <StatCard
          icon={Users}
          label="Total Customer Revenue"
          value={stats.totalRevenue}
          displayValue={formatCurrency(stats.totalRevenue)}
          iconClass="bg-amber-500/20 text-amber-400"
          delay={300}
        />
      </div>

      <GlassCard delay={150} className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-50 dark:bg-slate-800/50 py-2.5 pl-10 pr-4 text-slate-900 dark:text-slate-100"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200"
          >
            <option value="name">Name A-Z</option>
            <option value="spent">Total Spent</option>
            <option value="orders">Orders Count</option>
            <option value="recent">Recent</option>
          </select>
        </div>
      </GlassCard>

      <GlassCard delay={200} className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Check Shopify API scopes for read_customers." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase text-slate-500">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Orders</th>
                  <th className="px-5 py-3">Total Spent</th>
                  <th className="px-5 py-3">Last Order</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    className="page-fade-in cursor-pointer border-b border-slate-200 dark:border-slate-700/30 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/20"
                    style={{ animationDelay: `${200 + i * 30}ms` }}
                    onClick={() => openDetail(c)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${avatarColor(c.name)}`}
                        >
                          {(c.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{c.email}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs text-indigo-300">
                        {c.orders_count}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-emerald-400">{formatCurrency(c.total_spent)}</td>
                    <td className="px-5 py-4 text-slate-400">{timeAgo(c.last_order_at)}</td>
                    <td className="px-5 py-4 text-slate-400">
                      {countryFlag(c.country_code)} {c.city || c.country || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(c);
                        }}
                        className={`text-indigo-400 hover:text-indigo-300 ${BTN_PRESS}`}
                      >
                        View Orders
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="page-fade-in max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{selected.name}</h2>
                <button type="button" onClick={() => setSelected(null)} className="text-white/80">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${tagColors[selected.tag]}`}>
                  {selected.tag}
                </span>
              </div>
              <GlassCard className="p-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p className="flex items-center gap-2 text-slate-300">
                    <Mail className="h-4 w-4 text-slate-500" /> {selected.email || '—'}
                  </p>
                  <p className="flex items-center gap-2 text-slate-300">
                    <Phone className="h-4 w-4 text-slate-500" /> {selected.phone || '—'}
                  </p>
                  <p className="flex items-center gap-2 text-slate-300 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-slate-500" /> {selected.address || '—'}
                  </p>
                </div>
              </GlassCard>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selected.orders_count}</p>
                  <p className="text-xs text-slate-500">Total Orders</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{formatCurrency(selected.total_spent)}</p>
                  <p className="text-xs text-slate-500">Total Spent</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
                  <p className="text-2xl font-bold text-indigo-400">
                    {formatCurrency(selected.orders_count ? selected.total_spent / selected.orders_count : 0)}
                  </p>
                  <p className="text-xs text-slate-500">Avg Order</p>
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-200">Recent Orders</h3>
                {ordersLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : orders.length === 0 ? (
                  <p className="text-sm text-slate-500">No orders found.</p>
                ) : (
                  <div className="space-y-2">
                    {orders.map((o) => (
                      <div
                        key={o.shopify_order_id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 px-4 py-3"
                      >
                        <span className="font-medium text-indigo-400">{o.id}</span>
                        <OrderStatusBadge status={o.status} />
                        <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(o.total_price)}</span>
                        <span className="text-xs text-slate-500">{timeAgo(o.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Package, DollarSign, ShoppingCart, AlertTriangle, Download, Calendar } from 'lucide-react';
import { api, formatCurrency } from '../api/client';
import {
  GlassCard,
  PageHero,
  StatCard,
  ChartTooltip,
  BTN_PRESS,
} from '../components/premium-ui';

const STATUS_COLORS = ['#6366f1', '#94a3b8', '#f59e0b'];
const STOCK_COLORS = ['#3b82f6', '#f59e0b', '#ef4444'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    api
      .get('/api/analytics')
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Loading analytics…</div>;
  }

  const statusData = data?.by_status
    ? Object.entries(data.by_status).map(([name, value]) => ({ name, value }))
    : [];
  const statusTotal = statusData.reduce((s, d) => s + d.value, 0);

  const stockData = data?.stock_distribution
    ? [
        { name: 'In Stock', value: data.stock_distribution.in_stock },
        { name: 'Low', value: data.stock_distribution.low },
        { name: 'Out', value: data.stock_distribution.out },
      ]
    : [];

  const stockTotal =
    (data?.stock_distribution?.in_stock || 0) +
    (data?.stock_distribution?.low || 0) +
    (data?.stock_distribution?.out || 0);
  const healthScore = stockTotal
    ? Math.round(((data.stock_distribution.in_stock || 0) / stockTotal) * 100)
    : 0;
  const healthOffset = 2 * Math.PI * 42 * (1 - healthScore / 100);

  return (
    <div className="space-y-4">
      <PageHero
        title="Store Analytics"
        subtitle="Performance overview"
        pills={
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white ${BTN_PRESS}`}
          >
            <Download className="h-4 w-4" /> Export Report
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          {['7d', '30d', '90d'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1 text-xs capitalize ${BTN_PRESS} ${
                range === r ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </PageHero>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Package} label="Total Products" value={data?.total_products ?? 0} iconClass="bg-indigo-500/20 text-indigo-400" delay={100} />
        <StatCard icon={DollarSign} label="Inventory Value" displayValue={data?.inventory_value} value={0} iconClass="bg-emerald-500/20 text-emerald-400" delay={150} />
        <StatCard icon={ShoppingCart} label="Total Orders" value={data?.total_orders ?? 0} iconClass="bg-purple-500/20 text-purple-400" delay={200} />
        <StatCard icon={AlertTriangle} label="Low Stock" value={data?.low_stock ?? 0} iconClass="bg-amber-500/20 text-amber-400" delay={250} pulse={(data?.low_stock ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-1" delay={300} borderTop="from-indigo-600 to-purple-600">
          <h2 className="mb-2 text-center text-sm font-medium text-slate-400">Products by Status</h2>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} cx="50%" cy="50%">
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{statusTotal}</span>
              <span className="text-xs text-slate-500">total</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 lg:col-span-1" delay={350} borderTop="from-purple-600 to-pink-500">
          <h2 className="mb-4 text-sm font-medium text-slate-400">Stock Distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stockData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {stockData.map((e, i) => (
                  <Cell key={e.name} fill={STOCK_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5 lg:col-span-1" delay={400} borderTop="from-indigo-500 to-cyan-500">
          <h2 className="mb-4 text-sm font-medium text-slate-400">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.sales_last_30_days || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v) => v?.slice(5)} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip formatter={(v) => formatCurrency(v)} />} />
              <Line type="monotone" dataKey="revenue" stroke="#818cf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard className="p-5" delay={450}>
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">Top 5 by Inventory Value</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-3 pr-2">#</th>
                  <th className="pb-3 pr-2">Product</th>
                  <th className="pb-3 pr-2">Price</th>
                  <th className="pb-3 pr-2">Stock</th>
                  <th className="pb-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {(data?.top_products_by_value || []).map((p, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-200 dark:border-slate-700/30 ${i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900/20' : ''}`}
                  >
                    <td className="py-3 pr-2 text-slate-500">{i + 1}</td>
                    <td className="max-w-[140px] truncate py-3 pr-2 font-medium text-slate-800 dark:text-slate-200">{p.title}</td>
                    <td className="py-3 pr-2 text-slate-400">{formatCurrency(p.price)}</td>
                    <td className="py-3 pr-2">{p.stock}</td>
                    <td className="py-3 font-semibold text-indigo-400">{formatCurrency(p.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col items-center p-5" delay={500}>
          <h2 className="mb-4 self-start font-semibold text-slate-900 dark:text-slate-100">Inventory Health</h2>
          <div className="relative flex h-36 w-36 items-center justify-center">
            <svg className="-rotate-90" width="144" height="144" viewBox="0 0 144 144">
              <circle cx="72" cy="72" r="42" fill="none" stroke="#334155" strokeWidth="10" />
              <circle
                cx="72"
                cy="72"
                r="42"
                fill="none"
                stroke="url(#healthGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={healthOffset}
                className="transition-all duration-700"
              />
              <defs>
                <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute text-3xl font-bold text-slate-900 dark:text-slate-100">{healthScore}%</span>
          </div>
          <ul className="mt-6 w-full space-y-2 text-sm">
            {stockData.map((row, i) => (
              <li key={row.name} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: STOCK_COLORS[i] }} />
                  {row.name}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{row.value}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}

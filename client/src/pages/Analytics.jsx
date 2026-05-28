import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Legend,
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
import { api, formatCurrency, formatInventoryValue, dedupeByKey } from '../api/client';
import { useToast } from '../components/Toast';
import {
  GlassCard,
  PageHero,
  StatCard,
  ChartTooltip,
  BTN_PRESS,
} from '../components/premium-ui';

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

function csvCell(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function filterSalesByRange(sales, range) {
  const days = RANGE_DAYS[range] ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = cutoff.toISOString().split('T')[0];
  return (sales || []).filter((row) => row.date >= cutoffKey);
}

function buildAnalyticsCsv(data, range, salesRows, topProducts) {
  const lines = [
    'Store Analytics Report',
    `Generated,${new Date().toISOString()}`,
    `Date Range,${range}`,
    '',
    'Summary',
    `Total Products,${csvCell(data?.total_products ?? 0)}`,
    `Inventory Value,${csvCell(data?.inventory_value ?? 0)}`,
    `Inventory Value (raw),${csvCell(data?.inventory_value_raw ?? 0)}`,
    `Total Orders,${csvCell(data?.total_orders ?? 0)}`,
    `Low Stock,${csvCell(data?.low_stock ?? 0)}`,
    `Out of Stock,${csvCell(data?.out_of_stock ?? 0)}`,
    '',
    'Products by Status',
    'Status,Count',
  ];

  if (data?.by_status) {
    Object.entries(data.by_status).forEach(([name, value]) => {
      lines.push(`${csvCell(name)},${csvCell(value)}`);
    });
  }

  lines.push('', 'Stock Distribution', 'Category,Count');
  if (data?.stock_distribution) {
    const { in_stock, low, out } = data.stock_distribution;
    lines.push(`In Stock,${csvCell(in_stock)}`);
    lines.push(`Low,${csvCell(low)}`);
    lines.push(`Out,${csvCell(out)}`);
  }

  lines.push('', `Revenue Trend (${range})`, 'Date,Revenue');
  salesRows.forEach((row) => {
    lines.push(`${csvCell(row.date)},${csvCell(row.revenue)}`);
  });

  lines.push('', 'Top 5 Products by Inventory Value', 'Rank,Product,Price,Stock,Value');
  topProducts.forEach((p, i) => {
    lines.push(
      `${i + 1},${csvCell(p.title)},${csvCell(p.price)},${csvCell(p.stock)},${csvCell(p.total_value)}`
    );
  });

  return lines.join('\n');
}

function downloadCsvFile(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const STATUS_COLORS = { active: '#6366f1', draft: '#94a3b8', archived: '#f59e0b' };
const STATUS_LABELS = { active: 'Active', draft: 'Draft', archived: 'Archived' };
const STOCK_COLORS = ['#3b82f6', '#f59e0b', '#ef4444'];
const MEDALS = ['🥇', '🥈', '🥉'];

function rankDisplay(rankIndex) {
  if (rankIndex === 0) return MEDALS[0];
  if (rankIndex === 1) return MEDALS[1];
  if (rankIndex === 2) return MEDALS[2];
  return String(rankIndex + 1);
}

function statusColor(name) {
  const key = (name || 'active').toLowerCase();
  return STATUS_COLORS[key] || STATUS_COLORS.active;
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [range, setRange] = useState('30d');
  const { toast } = useToast();

  useEffect(() => {
    api
      .get('/api/analytics')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const salesForRange = useMemo(
    () => filterSalesByRange(data?.sales_last_30_days, range),
    [data?.sales_last_30_days, range]
  );

  const uniqueTop5 = useMemo(
    () =>
      dedupeByKey(data?.top_products_by_value || [], (p) => String(p.shopify_id)).slice(0, 5),
    [data?.top_products_by_value]
  );

  const handleExportReport = useCallback(() => {
    if (!data) {
      toast('warning', 'No data', 'Analytics data is still loading.');
      return;
    }
    setExporting(true);
    try {
      const csv = buildAnalyticsCsv(data, range, salesForRange, uniqueTop5);
      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadCsvFile(`store-analytics-${range}-${dateStamp}.csv`, csv);
      toast('success', 'Report exported', 'Your analytics CSV has been downloaded.');
    } catch (err) {
      toast('error', 'Export failed', err.message || 'Could not generate the report.');
    } finally {
      setExporting(false);
    }
  }, [data, range, salesForRange, uniqueTop5, toast]);

  const revenueYMax = useMemo(() => {
    const values = salesForRange.map((d) => d.revenue || 0);
    if (!values.length) return 1;
    const dataMax = Math.max(...values, 0);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const capped = avg > 0 ? Math.min(dataMax, avg * 3) : dataMax;
    const top = (capped || dataMax || 1) * 1.2;
    return top > 0 ? top : 1;
  }, [salesForRange]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400">Loading analytics…</div>;
  }

  const statusData = data?.by_status
    ? Object.entries(data.by_status).map(([name, value]) => ({
        name,
        label: STATUS_LABELS[name] || name,
        value,
        color: statusColor(name),
      }))
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
            onClick={handleExportReport}
            disabled={exporting || !data}
            className={`inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 ${BTN_PRESS}`}
          >
            <Download className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Exporting…' : 'Export Report'}
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
        <GlassCard className="flex min-h-[360px] flex-col overflow-visible p-5 lg:col-span-1" delay={300} borderTop="from-indigo-600 to-purple-600">
          <h2 className="mb-2 text-center text-sm font-medium text-slate-400">Products by Status</h2>
          <div className="pb-8">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                  cx="50%"
                  cy="45%"
                  label={false}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  iconType="circle"
                  legendType="circle"
                  wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                  formatter={(value) => (
                    <span className="text-slate-600 dark:text-slate-300">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-auto space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700/50">
            {statusData.map((entry) => (
              <li key={entry.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.label}
                </span>
                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {entry.value}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-700/50">
              <span>Total products</span>
              <span className="font-semibold tabular-nums">{statusTotal}</span>
            </li>
          </ul>
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
            <LineChart
              data={salesForRange}
              margin={{ top: 12, right: 16, left: 4, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => v?.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                width={56}
                domain={[0, revenueYMax]}
                tickFormatter={(v) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                }
              />
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
                {uniqueTop5.map((p, i) => (
                  <tr
                    key={p.shopify_id || i}
                    className={`border-t border-slate-200 dark:border-slate-700/30 ${i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900/20' : ''}`}
                  >
                    <td className="py-3 pr-2 text-lg leading-none">{rankDisplay(i)}</td>
                    <td className="max-w-[140px] truncate py-3 pr-2 font-medium text-slate-800 dark:text-slate-200">{p.title}</td>
                    <td className="py-3 pr-2 tabular-nums text-slate-600 dark:text-slate-300">{formatCurrency(p.price)}</td>
                    <td className="py-3 pr-2 tabular-nums text-slate-800 dark:text-slate-200">{p.stock}</td>
                    <td className="py-3 font-semibold tabular-nums text-indigo-500 dark:text-indigo-400">
                      {formatInventoryValue(p.total_value)}
                    </td>
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

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Radio,
} from 'lucide-react';
import { api, timeAgo } from '../api/client';
import { useApp } from '../components/Layout';
import {
  PageHero,
  GlassCard,
  StatCard,
  Pill,
  PillTabs,
  BTN_PRESS,
  GRADIENT_BTN,
  Skeleton,
  EmptyState,
} from '../components/premium-ui';

const STATUS_FILTERS = ['all', 'success', 'failed'];
const TYPE_FILTERS = ['all', 'manual', 'auto', 'webhook'];

function StatusBadge({ status }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Success
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs text-red-400">
        <XCircle className="h-3.5 w-3.5" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs text-blue-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> In Progress
    </span>
  );
}

function TypeBadge({ type }) {
  const colors = {
    manual: 'bg-indigo-500/20 text-indigo-400',
    auto: 'bg-purple-500/20 text-purple-400',
    webhook: 'bg-cyan-500/20 text-cyan-400',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${colors[type] || colors.manual}`}>
      {type}
    </span>
  );
}

export default function SyncLogs() {
  const { setLastSync, fetchSyncStatus } = useApp();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, successful: 0, failed: 0, avgSeconds: '0' });
  const [lastSync, setLastSyncLocal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [liveMode, setLiveMode] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const { data } = await api.get(`/api/sync-logs?${params}`);
      let items = data.logs || [];

      if (dateRange !== 'all') {
        const now = Date.now();
        const days = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : 30;
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        items = items.filter((l) => new Date(l.created_at).getTime() >= cutoff);
      }

      setLogs(items);
      setStats(data.stats || { total: 0, successful: 0, failed: 0, avgSeconds: '0' });
      setLastSyncLocal(data.last_sync);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, dateRange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!liveMode) return undefined;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [liveMode, load]);

  async function syncNow() {
    setSyncing(true);
    try {
      const { data } = await api.post('/api/settings/sync-products', { type: 'manual' });
      setLastSync(data.last_sync);
      fetchSyncStatus();
      await load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function clearLogs() {
    if (!confirm('Clear all sync logs? This cannot be undone.')) return;
    await api.post('/api/sync-logs/clear');
    load();
  }

  function formatTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Sync Logs"
        pills={
          <>
            {liveMode && (
              <Pill className="bg-red-500/30">
                <Radio className="h-3 w-3 animate-pulse" /> Live
              </Pill>
            )}
            <Pill>Last sync {timeAgo(lastSync)}</Pill>
          </>
        }
      >
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className={`inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 ${BTN_PRESS}`}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync Now
        </button>
      </PageHero>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={RefreshCw} label="Total Syncs" value={stats.total} iconClass="bg-indigo-500/20 text-indigo-400" delay={0} />
        <StatCard icon={CheckCircle2} label="Successful" value={stats.successful} iconClass="bg-emerald-500/20 text-emerald-400" delay={100} />
        <StatCard icon={XCircle} label="Failed" value={stats.failed} iconClass="bg-red-500/20 text-red-400" delay={200} />
        <StatCard
          icon={RefreshCw}
          label="Avg Sync Time"
          value={0}
          displayValue={`${stats.avgSeconds}s`}
          iconClass="bg-purple-500/20 text-purple-400"
          delay={300}
        />
      </div>

      <GlassCard delay={150} className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <PillTabs tabs={STATUS_FILTERS} active={statusFilter} onChange={setStatusFilter} />
            <PillTabs tabs={TYPE_FILTERS} active={typeFilter} onChange={setTypeFilter} />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/50 px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} />
              Live mode (30s)
            </label>
            <button
              type="button"
              onClick={clearLogs}
              className={`inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 ${BTN_PRESS}`}
            >
              <Trash2 className="h-4 w-4" />
              Clear Logs
            </button>
          </div>
        </div>
      </GlassCard>

      <GlassCard delay={200} className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState icon={RefreshCw} title="No sync logs yet" description="Run a sync from Settings or Sync Now above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase text-slate-500">
                  <th className="px-5 py-3" />
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Products</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const isOpen = expanded === log.id;
                  const productsSummary = `${log.total || 0} total, ${log.new_count || 0} new, ${log.updated_count || 0} updated`;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        className="page-fade-in border-b border-slate-200 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20"
                        style={{ animationDelay: `${200 + i * 30}ms` }}
                      >
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : log.id)}
                            className="text-slate-500 hover:text-slate-600 dark:text-slate-300"
                          >
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-400">{formatTime(log.created_at)}</td>
                        <td className="px-5 py-3">
                          <TypeBadge type={log.type} />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{productsSummary}</td>
                        <td className="px-5 py-3 text-slate-400">
                          {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {log.error ? 'Error' : log.details ? 'View' : '—'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${log.id}-detail`} className="bg-slate-50 dark:bg-slate-800/30">
                          <td colSpan={7} className="px-8 py-4 text-sm text-slate-400">
                            {log.details?.new_products?.length > 0 && (
                              <p>
                                <span className="text-slate-500">New:</span>{' '}
                                {log.details.new_products.join(', ')}
                              </p>
                            )}
                            {log.details?.low_stock?.length > 0 && (
                              <p className="mt-1">
                                <span className="text-slate-500">Low stock:</span>{' '}
                                {log.details.low_stock.map((p) => `${p.title} (${p.stock})`).join(', ')}
                              </p>
                            )}
                            {log.details?.api_calls && (
                              <p className="mt-1">
                                <span className="text-slate-500">API:</span> {log.details.api_calls.join(', ')}
                              </p>
                            )}
                            {log.error && (
                              <p className="mt-1 text-red-400">{log.error}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

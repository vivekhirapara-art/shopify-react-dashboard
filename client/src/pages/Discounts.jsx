import { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Plus,
  X,
  Copy,
  Check,
  Trash2,
  Pencil,
  Percent,
  DollarSign,
  Truck,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import {
  PageHero,
  GlassCard,
  StatCard,
  Pill,
  BTN_PRESS,
  GRADIENT_BTN,
  Skeleton,
  EmptyState,
} from '../components/premium-ui';

function statusBadge(status) {
  const map = {
    active: 'bg-emerald-500/20 text-emerald-400',
    expired: 'bg-red-500/20 text-red-400',
    scheduled: 'bg-amber-500/20 text-amber-400',
  };
  const labels = { active: '🟢 Active', expired: '🔴 Expired', scheduled: '🟡 Scheduled' };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || map.active}`}>
      {labels[status] || status}
    </span>
  );
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function Discounts() {
  const [discounts, setDiscounts] = useState([]);
  const [stats, setStats] = useState({ active: 0, totalUsed: 0, expiringSoon: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const [form, setForm] = useState({
    code: '',
    type: 'percentage',
    value: 20,
    minimum_amount: '',
    usage_limit: '',
    starts_at: '',
    ends_at: '',
    published: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/discounts');
      setDiscounts(data.discounts || []);
      setStats(data.stats || { active: 0, totalUsed: 0, expiringSoon: 0 });
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function generateCode() {
    const code = `SAVE${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setForm((f) => ({ ...f, code }));
  }

  async function copyCode(code) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/api/discounts', form);
      setModalOpen(false);
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this discount?')) return;
    try {
      await api.delete(`/api/discounts/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }

  const typeIcon = (type) => {
    if (type === 'Fixed') return DollarSign;
    if (type === 'Free Shipping') return Truck;
    return Percent;
  };

  return (
    <div className="space-y-6">
      <PageHero title="Discounts & Coupons" pills={<Pill>{stats.active} active</Pill>}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 ${BTN_PRESS}`}
        >
          <Plus className="h-4 w-4" />
          Create Discount
        </button>
      </PageHero>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {typeof error === 'object' ? JSON.stringify(error) : error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Tag} label="Active Discounts" value={stats.active} iconClass="bg-indigo-500/20 text-indigo-400" delay={0} />
        <StatCard icon={Tag} label="Total Used" value={stats.totalUsed} iconClass="bg-purple-500/20 text-purple-400" delay={100} />
        <StatCard icon={Tag} label="Revenue from Discounts" value={0} displayValue="—" iconClass="bg-emerald-500/20 text-emerald-400" delay={200} />
        <StatCard
          icon={Tag}
          label="Expiring Soon"
          value={stats.expiringSoon}
          iconClass="bg-red-500/20 text-red-400"
          pulse={stats.expiringSoon > 0}
          delay={300}
        />
      </div>

      <GlassCard delay={200} className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : discounts.length === 0 ? (
          <EmptyState icon={Tag} title="No discounts yet" description="Create a coupon or sync from Shopify price rules." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase text-slate-500">
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Value</th>
                  <th className="px-5 py-3">Usage</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((d, i) => {
                  const Icon = typeIcon(d.type);
                  const days = daysUntil(d.ends_at);
                  const usagePct = d.usage_limit ? Math.min(100, ((d.usage_count || 0) / d.usage_limit) * 100) : 0;
                  return (
                    <tr
                      key={d.id}
                      className="page-fade-in border-b border-slate-200 dark:border-slate-700/30 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/20"
                      style={{ animationDelay: `${200 + i * 30}ms` }}
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => copyCode(d.code)}
                          className={`inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-900/80 px-3 py-1 font-mono text-sm text-indigo-300 ${BTN_PRESS}`}
                        >
                          {d.code}
                          {copied === d.code ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2.5 py-0.5 text-xs text-slate-300">
                          <Icon className="h-3 w-3" />
                          {d.type}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">{d.value}</td>
                      <td className="px-5 py-4">
                        <p className="text-xs text-slate-400">
                          {d.usage_count || 0}
                          {d.usage_limit ? `/${d.usage_limit}` : ''} used
                        </p>
                        {d.usage_limit > 0 && (
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-700">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${usagePct}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">{statusBadge(d.status)}</td>
                      <td className={`px-5 py-4 text-sm ${days != null && days < 7 && days >= 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {d.ends_at ? new Date(d.ends_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button type="button" className={`text-slate-400 hover:text-indigo-400 ${BTN_PRESS}`}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(d.id)}
                            className={`text-slate-400 hover:text-red-400 ${BTN_PRESS}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="page-fade-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Create Discount</h2>
                <button type="button" onClick={() => setModalOpen(false)}>
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-6">
              <div className="flex gap-2">
                <input
                  placeholder="Discount code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="flex-1 rounded-xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/50 px-4 py-2.5 font-mono text-slate-900 dark:text-slate-100"
                  required
                />
                <button
                  type="button"
                  onClick={generateCode}
                  className={`flex items-center gap-1 rounded-xl border border-slate-600 px-3 text-sm text-slate-300 ${BTN_PRESS}`}
                >
                  <Sparkles className="h-4 w-4" />
                  Random
                </button>
              </div>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/50 px-4 py-2.5 text-slate-900 dark:text-slate-100"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
                <option value="shipping">Free Shipping</option>
              </select>
              {form.type !== 'shipping' && (
                <input
                  type="number"
                  placeholder="Value"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/50 px-4 py-2.5 text-slate-900 dark:text-slate-100"
                />
              )}
              <input
                type="number"
                placeholder="Minimum order amount"
                value={form.minimum_amount}
                onChange={(e) => setForm({ ...form, minimum_amount: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/50 px-4 py-2.5 text-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                placeholder="Usage limit"
                value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/50 px-4 py-2.5 text-slate-900 dark:text-slate-100"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  className="rounded-xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  className="rounded-xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <button type="submit" className={`w-full py-2.5 ${GRADIENT_BTN} ${BTN_PRESS}`}>
                Create Discount
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

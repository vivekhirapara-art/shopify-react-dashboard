import { useState, useEffect, useCallback } from 'react';
import {
  LayoutGrid,
  RefreshCw,
  ExternalLink,
  Pencil,
  Plus,
  X,
  Package,
  Layers,
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

const GRADIENTS = [
  'from-indigo-600 to-purple-600',
  'from-blue-600 to-indigo-600',
  'from-purple-600 to-pink-600',
];

const ADMIN_STORE = 'https://admin.shopify.com/store/testing24v';

export default function Collections() {
  const [collections, setCollections] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, productsInCollections: 0 });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    image: '',
    product_ids: [],
    published: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/collections');
      setCollections(data.collections || []);
      setStats(data.stats || { total: 0, active: 0, productsInCollections: 0 });
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get('/api/products').then(({ data }) => setProducts(Array.isArray(data) ? data : [])).catch(() => {});
  }, [load]);

  async function syncCollections() {
    setSyncing(true);
    await load();
    setSyncing(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/api/collections', form);
      setModalOpen(false);
      setForm({ title: '', description: '', image: '', product_ids: [], published: true });
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this collection from Shopify?')) return;
    try {
      await api.delete(`/api/collections/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Collections"
        pills={<Pill>{stats.total} collections</Pill>}
      >
        <button
          type="button"
          onClick={syncCollections}
          disabled={syncing}
          className={`inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 ${BTN_PRESS}`}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync Collections
        </button>
      </PageHero>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {typeof error === 'object' ? JSON.stringify(error) : error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={LayoutGrid} label="Total Collections" value={stats.total} iconClass="bg-indigo-500/20 text-indigo-400" delay={0} />
        <StatCard icon={Layers} label="Active" value={stats.active} iconClass="bg-emerald-500/20 text-emerald-400" delay={100} />
        <StatCard icon={Package} label="Products in Collections" value={stats.productsInCollections} iconClass="bg-purple-500/20 text-purple-400" delay={200} />
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => setModalOpen(true)} className={`inline-flex items-center gap-2 px-5 py-2.5 ${GRADIENT_BTN} ${BTN_PRESS}`}>
          <Plus className="h-4 w-4" />
          Add Collection
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <GlassCard>
          <EmptyState icon={LayoutGrid} title="No collections yet" description="Sync from Shopify or create a new collection." />
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c, i) => (
            <GlassCard key={c.id} delay={100 + i * 50} className="overflow-hidden">
              {c.image ? (
                <img src={c.image} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className={`flex h-36 items-center justify-center bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`}>
                  <LayoutGrid className="h-12 w-12 text-white/40" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{c.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      c.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/50 text-slate-400'
                    }`}
                  >
                    {c.status === 'active' ? 'Active' : 'Draft'}
                  </span>
                </div>
                <span className="mt-2 inline-block rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs text-indigo-300">
                  {c.products_count} products
                </span>
                <div className="mt-4 flex gap-2">
                  <a
                    href={`${ADMIN_STORE}/collections/${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-600/50 py-2 text-xs text-slate-300 hover:border-indigo-500/50 ${BTN_PRESS}`}
                  >
                    View on Shopify <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className={`rounded-lg border border-slate-600/50 px-3 py-2 text-slate-400 hover:text-red-400 ${BTN_PRESS}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="page-fade-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700/50 dark:bg-slate-800 shadow-2xl">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Add Collection</h2>
                <button type="button" onClick={() => setModalOpen(false)} className="text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-6">
              <input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700/50 dark:bg-slate-800/50 px-4 py-2.5 text-slate-900 dark:text-slate-100"
                required
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700/50 dark:bg-slate-800/50 px-4 py-2.5 text-slate-900 dark:text-slate-100"
                rows={3}
              />
              <input
                placeholder="Image URL"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700/50 dark:bg-slate-800/50 px-4 py-2.5 text-slate-900 dark:text-slate-100"
              />
              <div>
                <label className="mb-2 block text-sm text-slate-400">Products</label>
                <select
                  multiple
                  value={form.product_ids}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      product_ids: Array.from(e.target.selectedOptions, (o) => o.value),
                    })
                  }
                  className="h-32 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700/50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  {products.map((p) => (
                    <option key={p.shopify_id} value={p.shopify_id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                  className="rounded border-slate-600"
                />
                Published (Active)
              </label>
              <button type="submit" className={`w-full py-2.5 ${GRADIENT_BTN} ${BTN_PRESS}`}>
                Create Collection
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

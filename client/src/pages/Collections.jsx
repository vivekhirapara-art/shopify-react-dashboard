import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutGrid,
  RefreshCw,
  ExternalLink,
  Pencil,
  Trash2,
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
  INPUT_CLASS,
} from '../components/premium-ui';

const GRADIENTS = [
  'from-indigo-600 to-purple-600',
  'from-blue-600 to-indigo-600',
  'from-purple-600 to-pink-600',
];

const ADMIN_STORE = 'https://admin.shopify.com/store/testing24v';

const EMPTY_FORM = {
  title: '',
  description: '',
  image: '',
  product_ids: [],
  published: true,
};

export default function Collections() {
  const [collections, setCollections] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, productsInCollections: 0 });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [editingCollection, setEditingCollection] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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

  function closeModal() {
    setModalMode(null);
    setEditingCollection(null);
    setForm(EMPTY_FORM);
  }

  function openCreateModal() {
    setEditingCollection(null);
    setForm(EMPTY_FORM);
    setModalMode('create');
  }

  function editCollection(collection) {
    setEditingCollection(collection);
    setForm({
      title: collection.title || '',
      description: collection.description || '',
      image: collection.image || '',
      product_ids: [],
      published: collection.status === 'active',
    });
    setModalMode('edit');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (modalMode === 'edit' && editingCollection) {
        await api.put(`/api/collections/${editingCollection.id}`, {
          ...form,
          kind: editingCollection.kind,
        });
      } else {
        await api.post('/api/collections', form);
      }
      closeModal();
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCollection(id, title, kind) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/collections/${id}`, { params: kind ? { kind } : {} });
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  const isEdit = modalMode === 'edit';

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
        <button type="button" onClick={openCreateModal} className={`inline-flex items-center gap-2 px-5 py-2.5 ${GRADIENT_BTN} ${BTN_PRESS}`}>
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
                    onClick={(e) => e.stopPropagation()}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs text-slate-600 hover:border-indigo-500/50 dark:border-slate-600/50 dark:text-slate-300 ${BTN_PRESS}`}
                  >
                    View on Shopify <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    title="Edit collection"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      editCollection(c);
                    }}
                    className={`rounded-lg border border-slate-200 px-3 py-2 text-slate-500 hover:border-indigo-500/50 hover:text-indigo-500 dark:border-slate-600/50 dark:text-slate-400 dark:hover:text-indigo-300 ${BTN_PRESS}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete collection"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      deleteCollection(c.id, c.title, c.kind);
                    }}
                    className={`rounded-lg border border-slate-200 px-3 py-2 text-slate-500 hover:border-red-500/50 hover:text-red-500 dark:border-slate-600/50 dark:text-slate-400 dark:hover:text-red-400 ${BTN_PRESS}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {modalMode &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="page-fade-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700/50 dark:bg-slate-800">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">
                    {isEdit ? 'Edit Collection' : 'Add Collection'}
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-white/80 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 p-6">
                <input
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={INPUT_CLASS}
                  required
                />
                <textarea
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={INPUT_CLASS}
                  rows={3}
                />
                <input
                  placeholder="Image URL"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  className={INPUT_CLASS}
                />
                {!isEdit && (
                  <div>
                    <label className="mb-2 block text-sm text-slate-500 dark:text-slate-400">Products</label>
                    <select
                      multiple
                      value={form.product_ids}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          product_ids: Array.from(e.target.selectedOptions, (o) => o.value),
                        })
                      }
                      className="h-32 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-100"
                    >
                      {products.map((p) => (
                        <option key={p.shopify_id} value={p.shopify_id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm({ ...form, published: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                  Published (Active)
                </label>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className={`flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 ${BTN_PRESS}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`flex-1 py-2.5 ${GRADIENT_BTN} ${BTN_PRESS} disabled:opacity-50`}
                  >
                    {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Collection'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  Download,
  LayoutGrid,
  List,
  X,
  DollarSign,
  Hash,
  Tag,
  ImageIcon,
  Package,
  Type,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { api, formatCurrency, AUTH_STORAGE_KEY } from '../api/client';
import { useApp } from '../components/Layout';
import {
  GlassCard,
  PillTabs,
  CARD,
  BTN_PRESS,
  GRADIENT_BTN,
  INPUT_CLASS,
  SkeletonText,
} from '../components/premium-ui';
import { useToast } from '../components/Toast';

const PAGE_SIZE = 20;
const STATUS_TABS = ['all', 'active', 'draft'];
const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'price', label: 'Price ↑' },
  { value: 'price-desc', label: 'Price ↓' },
  { value: 'stock', label: 'Stock ↑' },
  { value: 'stock-desc', label: 'Stock ↓' },
];

const emptyProduct = {
  title: '',
  price: '',
  stock: '',
  status: 'active',
  vendor: '',
  image: '',
};

function getImageUrl(imageField) {
  if (!imageField) return null;
  const value = String(imageField).trim();
  if (!value) return null;
  if (value.startsWith('data:')) return value;
  if (value.startsWith('http')) {
    // If user pasted a local uploads URL, normalize to current origin so it works on ngrok too.
    if (value.includes('/uploads/')) {
      const key = value.split('/uploads/').pop();
      if (key) return `${window.location.origin}/uploads/${encodeURIComponent(key)}`;
    }
    return encodeURI(value);
  }
  // Partial filename - serve from same origin (proxied to :5000 in vite.config.js)
  return `${window.location.origin}/uploads/${encodeURIComponent(value.replace(/^\/+/, ''))}`;
}

function normalizeImageForShopify(imageField) {
  // Shopify needs a publicly reachable URL; for uploads use current origin (ngrok).
  const url = getImageUrl(imageField);
  return url || undefined;
}

function getStoreUrlFromAuth() {
  const auth = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
  return auth.storeUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || '';
}

function openAdminPanel(product) {
  const storeUrl = getStoreUrlFromAuth();
  if (!storeUrl || !product.shopify_id) return;
  window.open(`https://${storeUrl}/admin/products/${product.shopify_id}`, '_blank');
}

function openLiveStoreProduct(product) {
  const storeUrl = getStoreUrlFromAuth();
  if (!storeUrl) return;
  const handle = typeof product.handle === 'string' ? product.handle.trim() : '';
  const url = handle
    ? `https://${storeUrl}/products/${encodeURIComponent(handle)}`
    : `https://${storeUrl}/products/${product.shopify_id}`;
  window.open(url, '_blank');
}

const FIELD_ICONS = {
  title: Type,
  price: DollarSign,
  stock: Hash,
  vendor: Tag,
  image: ImageIcon,
  status: Package,
};

function ProductModal({ title, product, onClose, onSave, saving }) {
  const [form, setForm] = useState(product);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setForm((f) => ({ ...f, image: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="modal-panel relative mx-auto my-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-white shadow-2xl dark:bg-slate-800">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <button type="button" onClick={onClose} className={`text-white/80 hover:text-white ${BTN_PRESS}`}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 transition-colors ${
              dragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-200 bg-slate-50 dark:border-slate-600/50 dark:bg-slate-800/30'
            }`}
          >
            {getImageUrl(form.image) ? (
              <img
                src={getImageUrl(form.image)}
                alt=""
                className="max-h-40 rounded-xl object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <>
                <ImageIcon className="mb-2 h-10 w-10 text-slate-500" />
                <p className="text-center text-xs text-slate-500">Drag image or paste URL below</p>
              </>
            )}
          </div>
          <div className="space-y-3">
            {['title', 'price', 'stock', 'vendor', 'image', 'status'].map((field) => {
              const Icon = FIELD_ICONS[field];
              return (
                <div key={field}>
                  <label className="mb-1 flex items-center gap-1.5 text-xs text-slate-500 capitalize">
                    <Icon className="h-3.5 w-3.5" />
                    {field}
                  </label>
                  {field === 'status' ? (
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="active">active</option>
                      <option value="draft">draft</option>
                    </select>
                  ) : (
                    <input
                      type={field === 'price' || field === 'stock' ? 'number' : 'text'}
                      value={form[field]}
                      onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700/50">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 dark:border-slate-600/50 dark:text-slate-400 ${BTN_PRESS}`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(form)}
            className={`inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${saving ? 'btn-loading' : ''} ${GRADIENT_BTN} ${BTN_PRESS}`}
          >
            {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BulkPriceModal({ count, onClose, onApply, saving }) {
  const [mode, setMode] = useState('fixed');
  const [value, setValue] = useState('');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className={`modal-panel relative mx-auto my-8 w-full max-w-md rounded-2xl ${CARD} p-6`}>
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Bulk Price · {count} items</h2>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className={`mb-3 ${INPUT_CLASS}`}
        >
          <option value="fixed">Set Fixed Price</option>
          <option value="increase_percent">Increase %</option>
          <option value="decrease_percent">Decrease %</option>
          <option value="increase_amount">Increase Amount</option>
          <option value="decrease_amount">Decrease Amount</option>
        </select>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`mb-6 ${INPUT_CLASS}`}
        />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={`rounded-xl border border-slate-600/50 px-4 py-2 ${BTN_PRESS}`}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onApply(mode, parseFloat(value))}
            className={`rounded-xl px-5 py-2 text-white disabled:opacity-50 ${GRADIENT_BTN} ${BTN_PRESS}`}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const CSV_TEMPLATE = `title,price,stock,vendor,status
Sample Product,29.99,100,My Vendor,active`;

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'products-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function Products() {
  const { fetchSyncStatus } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('name-asc');
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/products');
      setProducts(data);
      fetchSyncStatus();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to load products',
        message: err.response?.data?.error || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    let list = [...products];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.title?.toLowerCase().includes(q) || p.vendor?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((p) => (p.status || 'active').toLowerCase() === statusFilter);
    }
    list.sort((a, b) => {
      if (sort === 'name-asc') return (a.title || '').localeCompare(b.title || '');
      if (sort === 'price') return (a.price || 0) - (b.price || 0);
      if (sort === 'price-desc') return (b.price || 0) - (a.price || 0);
      if (sort === 'stock') return (a.stock || 0) - (b.stock || 0);
      if (sort === 'stock-desc') return (b.stock || 0) - (a.stock || 0);
      return 0;
    });
    return list;
  }, [products, search, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        status: form.status,
        vendor: form.vendor,
        image: normalizeImageForShopify(form.image),
      };
      if (modal?.mode === 'add') await api.post('/api/products', payload);
      else await api.put(`/api/products/${modal.product.id}`, payload);
      setModal(null);
      await loadProducts();
      addToast({
        type: 'success',
        title: modal?.mode === 'add' ? 'Product created' : 'Product saved',
        message: form.title || 'Changes synced',
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', message: err.response?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete from Shopify?')) return;
    try {
      await api.delete(`/api/products/${id}`);
      await loadProducts();
      addToast({ type: 'success', title: 'Product deleted', message: 'Removed from your store' });
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.response?.data?.error || err.message });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} products?`)) return;
    try {
      await api.post('/api/products/bulk-delete', { ids: [...selected] });
      setSelected(new Set());
      await loadProducts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleImportCsv = async (file) => {
    setImporting(true);
    setImportStatus('Importing…');
    const formData = new FormData();
    formData.append('csv', file);
    try {
      const { data } = await api.post('/api/products/import-csv', formData);
      await loadProducts();
      const count = data.imported ?? 0;
      const errCount = data.errors?.length ?? 0;
      if (count > 0) {
        addToast({
          type: 'success',
          title: `${count} product${count === 1 ? '' : 's'} imported`,
          message: errCount > 0 ? `${errCount} row(s) had errors` : 'CSV import completed successfully',
        });
      } else if (errCount > 0) {
        addToast({
          type: 'error',
          title: 'Import failed',
          message: data.errors[0]?.error || 'No products could be imported',
        });
      } else {
        addToast({
          type: 'warning',
          title: 'No products imported',
          message: 'Check your CSV has title, price, and stock columns',
        });
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Import failed',
        message: err.response?.data?.error || err.message,
      });
    } finally {
      setImporting(false);
      setImportStatus('');
    }
  };

  const handleBulkPrice = async (mode, value) => {
    setSaving(true);
    try {
      await api.post('/api/products/bulk-price', { ids: [...selected], mode, value });
      setBulkPriceOpen(false);
      setSelected(new Set());
      await loadProducts();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const stockClass = (stock) => {
    if (stock === 0) return 'bg-red-500/20 text-red-400';
    if (stock < 10) return 'bg-amber-500/20 text-amber-400';
    return 'bg-emerald-500/20 text-emerald-400';
  };

  const statusClass = (status) => {
    const s = (status || 'active').toLowerCase();
    if (s === 'active') return 'bg-emerald-500/20 text-emerald-400';
    if (s === 'draft') return 'bg-slate-500/30 text-slate-400';
    return 'bg-amber-500/20 text-amber-400';
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="page-fade-in flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Products</h1>
          <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-sm font-medium text-indigo-300">
            {products.length}
          </span>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={() => window.open(`${api.defaults.baseURL}/api/products/export-csv`, '_blank')}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:border-indigo-500/40 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-300 sm:w-auto sm:justify-start ${BTN_PRESS}`}
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:border-indigo-500/40 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-300 sm:w-auto sm:justify-start ${BTN_PRESS}`}
          >
            <Download className="h-4 w-4" /> CSV Template
          </button>
          <span className="group relative">
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:border-indigo-500/40 disabled:opacity-70 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-300 sm:w-auto sm:justify-start ${BTN_PRESS}`}
              title="CSV must have columns: title, price, stock"
            >
              {importing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                  {importStatus || 'Importing…'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Import CSV
                </>
              )}
            </button>
            <span className="pointer-events-none absolute -bottom-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block dark:bg-slate-700">
              CSV: title, price, stock (optional: vendor, status, image)
            </span>
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await handleImportCsv(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => setModal({ mode: 'add', product: emptyProduct })}
            className={`flex w-full items-center justify-center gap-2 px-5 py-2 text-sm sm:w-auto ${GRADIENT_BTN} ${BTN_PRESS}`}
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      <GlassCard className="p-4" delay={100}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={`w-full ${INPUT_CLASS} py-2.5 pl-10 pr-4 text-sm`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PillTabs tabs={STATUS_TABS} active={statusFilter} onChange={(t) => { setStatusFilter(t); setPage(1); }} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={INPUT_CLASS}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`rounded-lg p-2 ${view === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500'} ${BTN_PRESS}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`rounded-lg p-2 ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500'} ${BTN_PRESS}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {loading ? (
        view === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="surface-card overflow-hidden rounded-2xl border">
                <div className="skeleton-shimmer aspect-square" />
                <div className="space-y-2 p-4">
                  <SkeletonText className="h-5 w-3/4" />
                  <SkeletonText className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <GlassCard className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonText key={i} className="h-12 w-full" />
            ))}
          </GlassCard>
        )
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginated.map((product, i) => (
            <GlassCard
              key={product.id}
              className={`group/card relative overflow-hidden p-0 ${
                selected.has(product.id) ? 'ring-2 ring-indigo-500/60' : ''
              }`}
              delay={150 + (i % 4) * 50}
            >
              <label
                className={`absolute left-3 top-3 z-10 transition-opacity ${
                  selected.has(product.id) ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={() => toggleSelect(product.id)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
              </label>
              <span className={`absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusClass(product.status)}`}>
                {product.status || 'active'}
              </span>
              <div
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900"
                onClick={() => navigate(`/products/${product.id}`)}
              >
                {getImageUrl(product.image) ? (
                  <img
                    src={getImageUrl(product.image)}
                    alt={product.title}
                    className="img-fade h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
                    onLoad={(e) => e.currentTarget.classList.add('loaded')}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-600 transition-transform duration-200 ease-out group-hover:scale-105">
                    <Package className="h-12 w-12" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => navigate(`/products/${product.id}`)}
                  className={`block w-full truncate text-left font-semibold text-slate-900 hover:text-indigo-300 dark:text-slate-100 ${BTN_PRESS}`}
                  title="Open product details"
                >
                  {product.title}
                </button>
                {product.vendor && <p className="truncate text-xs text-slate-500">{product.vendor}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-lg font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(product.price)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stockClass(product.stock)}`}>
                    {product.stock}
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">{product.status}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex flex-1 gap-2 opacity-0 transition-opacity group-hover/card:opacity-100">
                    <button
                      type="button"
                      onClick={() => setModal({ mode: 'edit', product: { ...product } })}
                      className={`flex-1 rounded-lg border border-slate-600/50 py-2 hover:bg-indigo-500/10 ${BTN_PRESS}`}
                      title="Edit"
                    >
                      <Pencil className="mx-auto h-4 w-4 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id)}
                      className={`flex-1 rounded-lg border border-red-500/30 py-2 hover:bg-red-500/10 ${BTN_PRESS}`}
                      title="Delete"
                    >
                      <Trash2 className="mx-auto h-4 w-4 text-red-400" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="group relative">
                      <button
                        type="button"
                        title="Open in Shopify Admin"
                        disabled={!product.shopify_id}
                        onClick={() => openAdminPanel(product)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 ${BTN_PRESS}`}
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <span className="pointer-events-none absolute -top-9 right-0 z-10 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block dark:bg-slate-700">
                        Admin Panel
                      </span>
                    </span>
                    <span className="group relative">
                      <button
                        type="button"
                        title="Open live storefront product"
                        disabled={!product.shopify_id}
                        onClick={() => openLiveStoreProduct(product)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40 ${BTN_PRESS}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <span className="pointer-events-none absolute -top-9 right-0 z-10 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block dark:bg-slate-700">
                        Live Store
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="overflow-hidden p-0" delay={150}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 dark:border-slate-700/50 dark:bg-slate-800/30">
                <th className="px-4 py-3" />
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((product) => (
                <tr key={product.id} className="table-row-hover border-b border-slate-200 hover:bg-indigo-500/5 dark:border-slate-700/30">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleSelect(product.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{product.title}</td>
                  <td className="px-4 py-3 text-indigo-400">{formatCurrency(product.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${stockClass(product.stock)}`}>{product.stock}</span>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-400">{product.status}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setModal({ mode: 'edit', product })} className="text-indigo-400">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className={`rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-800/50 ${BTN_PRESS}`}>
            Prev
          </button>
          <span className="flex items-center text-sm text-slate-500">{page} / {totalPages}</span>
          <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className={`rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-800/50 ${BTN_PRESS}`}>
            Next
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="slide-up-bar surface-card fixed bottom-8 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl border border-indigo-500/40 px-6 py-4 shadow-2xl shadow-indigo-500/20 backdrop-blur-md">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{selected.size} selected</span>
          <button type="button" onClick={handleBulkDelete} className={`rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-400 ${BTN_PRESS}`}>
            Bulk Delete
          </button>
          <button type="button" onClick={() => setBulkPriceOpen(true)} className={`rounded-xl px-4 py-2 text-sm text-white ${GRADIENT_BTN} ${BTN_PRESS}`}>
            Bulk Price
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className={`text-sm text-slate-500 hover:text-slate-300 ${BTN_PRESS}`}>
            Deselect All
          </button>
        </div>
      )}

      {modal && (
        <ProductModal
          title={modal.mode === 'add' ? 'Add Product' : 'Edit Product'}
          product={modal.product}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
      {bulkPriceOpen && (
        <BulkPriceModal count={selected.size} onClose={() => setBulkPriceOpen(false)} onApply={handleBulkPrice} saving={saving} />
      )}
    </div>
  );
}

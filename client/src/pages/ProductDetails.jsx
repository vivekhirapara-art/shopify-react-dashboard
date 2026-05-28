import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Package, Save, Settings, Upload } from 'lucide-react';
import { api, formatCurrency, AUTH_STORAGE_KEY } from '../api/client';
import { GlassCard, BTN_PRESS, GRADIENT_BTN, INPUT_CLASS, SkeletonText } from '../components/premium-ui';
import { useToast } from '../components/Toast';

function StatusPills({ value, onChange }) {
  const isActive = String(value || 'active').toLowerCase() === 'active';
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700/50 dark:bg-slate-800/50">
      <button
        type="button"
        onClick={() => onChange('active')}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
          isActive ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/40'
        } ${BTN_PRESS}`}
      >
        Active
      </button>
      <button
        type="button"
        onClick={() => onChange('draft')}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
          !isActive ? 'bg-slate-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/40'
        } ${BTN_PRESS}`}
      >
        Draft
      </button>
    </div>
  );
}

function getStoreUrlFromAuth() {
  const auth = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
  const raw = typeof auth.storeUrl === 'string' ? auth.storeUrl : '';
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function getImageUrl(imageField) {
  if (!imageField) return null;
  const value = String(imageField).trim();
  if (!value) return null;
  if (value.startsWith('data:')) return value;
  if (value.startsWith('http')) {
    if (value.includes('/uploads/')) {
      const key = value.split('/uploads/').pop();
      if (key) return `${window.location.origin}/uploads/${encodeURIComponent(key)}`;
    }
    return encodeURI(value);
  }
  return `${window.location.origin}/uploads/${encodeURIComponent(value.replace(/^\/+/, ''))}`;
}

function normalizeImageForShopify(imageField) {
  const url = getImageUrl(imageField);
  return url || undefined;
}

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState(null);

  const media = useMemo(() => {
    const fromApi = Array.isArray(product?.images) ? product.images : [];
    const normalized = fromApi
      .map((img) => (img && img.src ? getImageUrl(img.src) : null))
      .filter(Boolean);
    if (normalized.length) return normalized;
    const fallback = getImageUrl(form?.image || product?.image);
    return fallback ? [fallback] : [];
  }, [product?.images, product?.image, form?.image]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/products/${id}`);
      setProduct(data);
      setForm({
        title: data?.title || '',
        description: data?.description || '',
        vendor: data?.vendor || '',
        price: String(data?.price ?? ''),
        stock: String(data?.stock ?? ''),
        status: data?.status || 'active',
        image: data?.image || '',
      });
    } catch (err) {
      toast('error', 'Failed to load product', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openAdminPanel = () => {
    const storeUrl = getStoreUrlFromAuth();
    if (!storeUrl || !product?.shopify_id) return;
    window.open(`https://${storeUrl}/admin/products/${product.shopify_id}`, '_blank');
  };

  const openLiveStore = () => {
    const storeUrl = getStoreUrlFromAuth();
    if (!storeUrl || !product?.shopify_id) return;
    const handle = typeof product.handle === 'string' ? product.handle.trim() : '';
    const url = handle ? `https://${storeUrl}/products/${encodeURIComponent(handle)}` : `https://${storeUrl}/products/${product.shopify_id}`;
    window.open(url, '_blank');
  };

  const onSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        vendor: form.vendor,
        status: form.status,
        price: form.price,
        stock: form.stock,
        image: normalizeImageForShopify(form.image),
      };
      const { data } = await api.put(`/api/products/${id}`, payload);
      setProduct(data);
      toast('success', 'Saved', 'Product updated successfully');
    } catch (err) {
      toast('error', 'Save failed', err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const onUploadImages = async (files) => {
    const arr = Array.from(files || []).filter(Boolean);
    if (!arr.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      arr.forEach((file) => formData.append('images', file));
      const { data } = await api.post(`/api/products/${id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProduct(data);
      toast('success', 'Uploaded', `${arr.length} image${arr.length === 1 ? '' : 's'} added`);
    } catch (err) {
      toast('error', 'Upload failed', err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/products')} className={`rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 ${BTN_PRESS}`}>
            <ArrowLeft className="mr-2 inline h-4 w-4" /> Back
          </button>
          <SkeletonText className="h-6 w-56" />
        </div>
        <GlassCard className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="skeleton-shimmer aspect-square w-full rounded-2xl" />
            <div className="space-y-3">
              <SkeletonText className="h-10 w-full" />
              <SkeletonText className="h-10 w-full" />
              <SkeletonText className="h-10 w-full" />
              <SkeletonText className="h-28 w-full" />
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!product || !form) {
    return (
      <div className="space-y-4 pb-24">
        <button type="button" onClick={() => navigate('/products')} className={`rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 ${BTN_PRESS}`}>
          <ArrowLeft className="mr-2 inline h-4 w-4" /> Back
        </button>
        <GlassCard className="p-6">
          <div className="text-sm text-slate-500">Product not found.</div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/products')} className={`rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 ${BTN_PRESS}`}>
            <ArrowLeft className="mr-2 inline h-4 w-4" /> Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{product.title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openAdminPanel} disabled={!product.shopify_id} className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:border-indigo-500/40 disabled:opacity-50 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 ${BTN_PRESS}`}>
            <Settings className="h-4 w-4" /> Admin Panel
          </button>
          <button type="button" onClick={openLiveStore} disabled={!product.shopify_id} className={`flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50 ${BTN_PRESS}`}>
            <ExternalLink className="h-4 w-4" /> Live Store
          </button>
          <button type="button" onClick={onSave} disabled={saving} className={`flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-70 ${GRADIENT_BTN} ${BTN_PRESS}`}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <GlassCard className="p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Media</div>
              <label className="group relative">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length) onUploadImages(files);
                    e.target.value = '';
                  }}
                />
                <span
                  className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-indigo-500/40 disabled:opacity-60 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 ${BTN_PRESS}`}
                  title="Upload images from your PC"
                  aria-disabled={uploading}
                >
                  {uploading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? 'Uploading…' : 'Add'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {media.slice(0, 4).map((src) => (
                <div
                  key={src}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800/30"
                >
                  <img
                    src={src}
                    alt=""
                    className="aspect-square w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ))}
              {media.length === 0 && (
                <div className="col-span-2 flex aspect-square items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700/50 dark:bg-slate-800/30">
                  <Package className="h-12 w-12" />
                </div>
              )}
            </div>
            <div className="text-[11px] text-slate-500">Select multiple images from your PC to upload to Shopify.</div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3">
              <label className="text-xs font-medium text-slate-500">Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={INPUT_CLASS} />
            </div>

            <div className="grid gap-3">
              <label className="text-xs font-medium text-slate-500">Vendor</label>
              <input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} className={INPUT_CLASS} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-3">
                <label className="text-xs font-medium text-slate-500">Price</label>
                <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={INPUT_CLASS} />
                <div className="text-[11px] text-slate-500">Now: {formatCurrency(Number(form.price) || 0)}</div>
              </div>
              <div className="grid gap-3">
                <label className="text-xs font-medium text-slate-500">Stock</label>
                <input value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} className={INPUT_CLASS} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-3">
                <label className="text-xs font-medium text-slate-500">Status</label>
                <StatusPills value={form.status} onChange={(next) => setForm((f) => ({ ...f, status: next }))} />
              </div>
              <div className="grid gap-3">
                <label className="text-xs font-medium text-slate-500">Primary image URL (optional)</label>
                <input
                  value={form.image}
                  onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="Paste a URL (optional)"
                />
              </div>
            </div>

            <div className="grid gap-3">
              <label className="text-xs font-medium text-slate-500">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={7}
                className={`${INPUT_CLASS} min-h-[160px]`}
              />
              <div className="text-[11px] text-slate-500">Saved to Shopify as product description (body_html).</div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}


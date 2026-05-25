import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image,
  Upload,
  Search,
  Grid3X3,
  List,
  Copy,
  Check,
  Trash2,
  X,
  CheckSquare,
} from 'lucide-react';
import { api } from '../api/client';
import {
  PageHero,
  GlassCard,
  Pill,
  PillTabs,
  BTN_PRESS,
  GRADIENT_BTN,
  Skeleton,
  EmptyState,
} from '../components/premium-ui';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export default function MediaLibrary() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('recent');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState(null);
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/media');
      setMedia(data.media || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = media
    .filter((m) => {
      const q = search.toLowerCase();
      if (q && !m.filename.toLowerCase().includes(q)) return false;
      if (filter === 'used') return m.used;
      if (filter === 'unused') return !m.used;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'name') return a.filename.localeCompare(b.filename);
      if (sort === 'size') return (b.size || 0) - (a.size || 0);
      return new Date(b.created_at) - new Date(a.created_at);
    });

  async function uploadFiles(files) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      setUploadProgress(Math.round(((i + 0.5) / files.length) * 100));
      try {
        await api.post('/api/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      }
    }
    setUploadProgress(100);
    setTimeout(() => setUploadProgress(null), 800);
    load();
  }

  function onDrop(e) {
    e.preventDefault();
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) uploadFiles(files);
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteItem(id) {
    if (!confirm('Delete this image?')) return;
    await api.delete(`/api/media/${id}`);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    load();
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} images?`)) return;
    for (const id of selected) {
      await api.delete(`/api/media/${id}`);
    }
    setSelected(new Set());
    load();
  }

  function bulkCopyUrls() {
    const urls = filtered.filter((m) => selected.has(m.id)).map((m) => m.url);
    navigator.clipboard.writeText(urls.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyUrl(url) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <PageHero title="Media Library" pills={<Pill>{media.length} images</Pill>}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 ${BTN_PRESS}`}
        >
          <Upload className="h-4 w-4" />
          Upload Images
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => e.target.files?.length && uploadFiles([...e.target.files])}
        />
      </PageHero>

      <GlassCard delay={50} className="border-2 border-dashed border-slate-600/50 p-8 text-center">
        <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <Upload className="mx-auto h-10 w-10 text-slate-500" />
        <p className="mt-3 text-slate-600 dark:text-slate-300">Drop images here or click to upload</p>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG, WebP, GIF — max 10MB</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`mt-4 px-4 py-2 text-sm ${GRADIENT_BTN} ${BTN_PRESS}`}
        >
          Choose files
        </button>
        {uploadProgress != null && (
          <div className="mx-auto mt-4 max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">Uploading… {uploadProgress}%</p>
          </div>
        )}
        </div>
      </GlassCard>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <GlassCard delay={100} className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search images..."
              className="w-full rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-100 dark:bg-slate-800/50 py-2.5 pl-10 pr-4 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PillTabs tabs={['all', 'used', 'unused']} active={filter} onChange={setFilter} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            >
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700/50 p-1">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`rounded-lg p-2 ${view === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400'} ${BTN_PRESS}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`rounded-lg p-2 ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400'} ${BTN_PRESS}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState icon={Image} title="No images yet" description="Upload files to build your media library." />
        </GlassCard>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((m, i) => (
            <GlassCard
              key={m.id}
              delay={100 + i * 30}
              className={`group relative cursor-pointer overflow-hidden p-0 ${
                selected.has(m.id) ? 'ring-2 ring-indigo-500' : ''
              }`}
              onClick={() => setDetail(m)}
            >
              <img src={m.url} alt="" className="aspect-square w-full object-cover" />
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate text-xs font-medium text-white">{m.filename}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{formatBytes(m.size)}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyUrl(m.url);
                    }}
                    className={`rounded-lg bg-white/10 px-2 py-1 text-xs text-white ${BTN_PRESS}`}
                  >
                    Copy URL
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(m.id);
                    }}
                    className={`rounded-lg bg-red-500/30 px-2 py-1 text-xs text-red-200 ${BTN_PRESS}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(m.id);
                }}
                className={`absolute left-2 top-2 rounded-lg bg-black/50 p-1 opacity-0 group-hover:opacity-100 ${selected.has(m.id) ? 'opacity-100' : ''}`}
              >
                {selected.has(m.id) ? (
                  <CheckSquare className="h-4 w-4 text-indigo-400" />
                ) : (
                  <span className="block h-4 w-4 rounded border border-white/50" />
                )}
              </button>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="divide-y divide-slate-700/50">
          {filtered.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-700/20">
              <img src={m.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800 dark:text-slate-200">{m.filename}</p>
                <p className="text-xs text-slate-500">{formatBytes(m.size)}</p>
              </div>
              <button type="button" onClick={() => copyUrl(m.url)} className={`text-indigo-400 ${BTN_PRESS}`}>
                <Copy className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => deleteItem(m.id)} className={`text-red-400 ${BTN_PRESS}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </GlassCard>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar-enter fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 px-6 py-4 shadow-2xl backdrop-blur-md">
          <span className="text-sm text-slate-600 dark:text-slate-300">{selected.size} selected</span>
          <button type="button" onClick={bulkDelete} className={`text-sm text-red-400 ${BTN_PRESS}`}>
            Delete selected
          </button>
          <button type="button" onClick={bulkCopyUrls} className={`text-sm text-indigo-400 ${BTN_PRESS}`}>
            {copied ? 'Copied!' : 'Copy all URLs'}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className={`text-sm text-slate-400 ${BTN_PRESS}`}>
            Clear
          </button>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="page-fade-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-200 dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50 px-6 py-4">
              <h2 className="font-bold text-slate-900 dark:text-slate-100">{detail.filename}</h2>
              <button type="button" onClick={() => setDetail(null)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <img src={detail.url} alt="" className="max-h-64 w-full object-contain bg-black/40" />
            <div className="space-y-3 p-6 text-sm">
              <p>
                <span className="text-slate-500">Size:</span> {formatBytes(detail.size)}
              </p>
              <p>
                <span className="text-slate-500">Uploaded:</span>{' '}
                {new Date(detail.created_at).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <input readOnly value={detail.url} className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300" />
                <button type="button" onClick={() => copyUrl(detail.url)} className={`${GRADIENT_BTN} px-3 py-2 ${BTN_PRESS}`}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              {detail.used_in?.length > 0 && (
                <div>
                  <p className="mb-2 text-slate-500">Used in products</p>
                  <ul className="space-y-1">
                    {detail.used_in.map((p) => (
                      <li key={p.shopify_id} className="text-slate-600 dark:text-slate-300">
                        {p.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

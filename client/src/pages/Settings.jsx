import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  BadgeCheck,
  Trash2,
  HelpCircle,
  Zap,
  Package,
  ShoppingCart,
  Boxes,
  PlusCircle,
  RotateCcw,
  Ban,
  X,
  Clock,
  Link2,
  Shield,
  Webhook,
  Radio,
} from 'lucide-react';
import { api, timeAgo } from '../api/client';
import { useApp } from '../components/Layout';
import { isAutoSyncEnabled, setAutoSyncEnabled } from '../lib/syncConfig';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const STORE_SLUG = 'testing24v';
const STORE_DOMAIN = 'testing24v.myshopify.com';
const API_VERSION = '2024-01';
const ADMIN_BASE = `https://admin.shopify.com/store/${STORE_SLUG}`;
const WEBHOOKS_ADMIN_URL = `${ADMIN_BASE}/settings/notifications/webhooks`;

const CARD =
  'rounded-2xl border border-slate-200 bg-white backdrop-blur-sm transition-all duration-300 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10 dark:border-slate-700/50 dark:bg-slate-800/50';

const BTN_PRESS = 'transition-transform active:scale-[0.97]';

const WEBHOOKS = [
  { slug: 'order-created', label: 'Order Creation', path: '/webhook/order-created', icon: PlusCircle },
  { slug: 'order-updated', label: 'Order Update', path: '/webhook/order-updated', icon: RotateCcw },
  { slug: 'order-cancelled', label: 'Order Cancellation', path: '/webhook/order-cancelled', icon: Ban },
];

const REQUIRED_SCOPES = [
  'read_orders',
  'write_orders',
  'read_products',
  'write_products',
  'read_inventory',
  'write_inventory',
  'read_price_rules',
  'write_price_rules',
];

const HEALTH_ROWS = [
  { key: 'products', label: 'Products API', icon: Package },
  { key: 'orders', label: 'Orders API', icon: ShoppingCart },
  { key: 'inventory', label: 'Inventory API', icon: Boxes },
];

function GlassCard({ children, className = '', delay = 0, danger = false }) {
  return (
    <div
      className={`settings-fade-in ${CARD} ${danger ? 'border-red-500/30 hover:border-red-500/50 hover:shadow-red-500/10' : ''} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function ScopeRing({ active, total }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const pct = total ? active / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
        <defs>
          <linearGradient id="scopeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgb(51 65 85 / 0.8)" strokeWidth="7" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="url(#scopeGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-foreground">
          {active}/{total}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted">scopes</span>
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative max-w-md w-full rounded-2xl border border-slate-300 dark:border-slate-600/50 bg-white dark:bg-slate-900/95 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur-md settings-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className={`rounded-lg p-1 text-muted hover:text-foreground ${BTN_PRESS}`}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function WebhookHelpTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`rounded-full p-1 text-muted hover:bg-slate-700/50 hover:text-foreground ${BTN_PRESS}`}
        aria-label="Webhook setup help"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-8 z-20 w-64 rounded-xl border border-slate-300 dark:border-slate-600/60 bg-white dark:bg-slate-900/95 p-3 text-xs text-muted shadow-xl backdrop-blur-md">
            <p className="mb-2 font-medium text-foreground">Setup</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Copy URL chip</li>
              <li>Shopify → Notifications → Webhooks</li>
              <li>Format: JSON</li>
              <li>Save — dot turns green on first event</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

export default function Settings() {
  const { lastSync, setLastSync, fetchSyncStatus } = useApp();
  const [storeInfo, setStoreInfo] = useState({ name: STORE_SLUG });
  const [productCount, setProductCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [copiedPath, setCopiedPath] = useState(null);
  const [webhookStatus, setWebhookStatus] = useState([]);
  const [scopes, setScopes] = useState(null);
  const [scopesLoading, setScopesLoading] = useState(true);
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pingStep, setPingStep] = useState(-1);
  const [connectionTest, setConnectionTest] = useState(null);
  const [autoSync, setAutoSync] = useState(isAutoSyncEnabled);
  const [clearing, setClearing] = useState(false);
  const progressTimer = useRef(null);

  const loadWebhookStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/api/settings/webhooks-status');
      setWebhookStatus(data.webhooks || []);
    } catch {
      setWebhookStatus([]);
    }
  }, []);

  const loadScopes = useCallback(async () => {
    setScopesLoading(true);
    try {
      const { data } = await api.get('/api/settings/scopes');
      setScopes(data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setScopes({
        allOk: false,
        scopes: Object.fromEntries(REQUIRED_SCOPES.map((s) => [s, { ok: false }])),
        missing: [...REQUIRED_SCOPES],
        error: msg,
      });
    } finally {
      setScopesLoading(false);
    }
  }, []);

  const loadSyncHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/api/settings/sync-history');
      setSyncHistory(data.history || []);
      if (data.last_sync) setLastSync(data.last_sync);
    } catch {
      /* ignore */
    }
  }, [setLastSync]);

  const loadProductCount = useCallback(async () => {
    try {
      const { data } = await api.get('/api/analytics');
      setProductCount(data.total_products ?? 0);
    } catch {
      try {
        const { data } = await api.get('/api/products');
        setProductCount(Array.isArray(data) ? data.length : 0);
      } catch {
        setProductCount(0);
      }
    }
  }, []);

  useEffect(() => {
    api.get('/api/settings/store').then((r) => setStoreInfo(r.data)).catch(() => {});
    loadWebhookStatus();
    loadScopes();
    loadSyncHistory();
    loadProductCount();
  }, [loadWebhookStatus, loadScopes, loadSyncHistory, loadProductCount]);

  const handleSync = useCallback(
    async (silent = false) => {
      setSyncing(true);
      setSyncResult(null);
      if (progressTimer.current) clearInterval(progressTimer.current);

      try {
        const { data } = await api.post('/api/settings/sync-products');
        setSyncResult(data);
        setLastSync(data.last_sync);
        setProductCount(data.synced ?? productCount);
        fetchSyncStatus();
        loadSyncHistory();
        loadProductCount();
      } catch (err) {
        if (!silent) alert(err.response?.data?.error || err.message);
      } finally {
        setSyncing(false);
      }
    },
    [setLastSync, fetchSyncStatus, loadSyncHistory, loadProductCount]
  );

  useEffect(() => {
    const onAutoSyncChange = () => setAutoSync(isAutoSyncEnabled());
    window.addEventListener('auto-sync-changed', onAutoSyncChange);
    return () => window.removeEventListener('auto-sync-changed', onAutoSyncChange);
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionTest(null);
    setPingStep(0);
    const steps = [0, 1, 2, 3];
    for (let i = 0; i < steps.length; i++) {
      setPingStep(steps[i]);
      await new Promise((r) => setTimeout(r, 400));
    }
    try {
      const { data } = await api.post('/api/settings/test-connection');
      setConnectionTest(data);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setTesting(false);
      setPingStep(-1);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm('Clear all locally cached data and re-sync from Shopify?')) return;
    setClearing(true);
    try {
      const { data } = await api.post('/api/settings/clear-database');
      alert(data.message);
      loadSyncHistory();
      fetchSyncStatus();
      loadProductCount();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setClearing(false);
    }
  };

  const copyWebhook = async (path) => {
    await navigator.clipboard.writeText(`${API_BASE}${path}`);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const toggleAutoSync = (value) => {
    setAutoSync(value);
    setAutoSyncEnabled(value);
  };

  const webhookActive = (slug) => webhookStatus.find((w) => w.slug === slug)?.active;

  const missingScopes =
    scopes?.missing?.length > 0
      ? scopes.missing
      : REQUIRED_SCOPES.filter((id) => !scopes?.scopes?.[id]?.ok);
  const activeScopeCount = REQUIRED_SCOPES.length - missingScopes.length;
  const storeName = storeInfo.name || STORE_SLUG;
  const storeInitial = storeName.charAt(0).toUpperCase();
  const shortUrl = (path) => {
    const full = `${API_BASE}${path}`;
    return full.length > 32 ? `…${full.slice(-28)}` : full;
  };

  const timeline = syncHistory.slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Hero — Store */}
        <GlassCard className="col-span-full overflow-hidden p-0" delay={0}>
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="avatar-glow-ring flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-3xl font-bold text-white ring-2 ring-emerald-400/60 backdrop-blur-sm">
                  {storeInitial}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {storeName}
                    </h1>
                    <BadgeCheck className="h-6 w-6 text-emerald-300" />
                  </div>
                  <p className="mt-1 text-sm text-indigo-100/80">
                    {storeInfo.plan || 'Development Store'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Connected
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                  API {API_VERSION}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                  <Package className="mr-1 inline h-3 w-3" />
                  {productCount} Products
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <a
              href={ADMIN_BASE}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-indigo-500/50 hover:text-indigo-600 dark:border-slate-600/60 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:text-white ${BTN_PRESS}`}
            >
              <Link2 className="h-4 w-4" />
              {STORE_DOMAIN}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
            <span className="flex items-center gap-2 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" />
              Last sync {timeAgo(lastSync)}
            </span>
          </div>
        </GlassCard>

        {/* Webhooks */}
        <GlassCard className="p-5" delay={100}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-indigo-400" />
              <h2 className="font-semibold">Webhooks</h2>
            </div>
            <WebhookHelpTooltip />
          </div>
          <ul className="space-y-2">
            {WEBHOOKS.map(({ slug, label, path, icon: Icon }) => {
              const active = webhookActive(slug);
              const copied = copiedPath === path;
              return (
                <li
                  key={path}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-900/30 px-3 py-2.5"
                >
                  <Icon className="h-4 w-4 shrink-0 text-indigo-400" />
                  <span className="w-28 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
                  <button
                    type="button"
                    onClick={() => copyWebhook(path)}
                    className={`min-w-0 flex-1 truncate rounded-lg bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 text-left font-mono text-[10px] text-slate-400 transition-colors hover:bg-indigo-500/10 hover:text-indigo-300 ${BTN_PRESS}`}
                    title={`${API_BASE}${path}`}
                  >
                    {copied ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="h-3 w-3" /> Copied
                      </span>
                    ) : (
                      shortUrl(path)
                    )}
                  </button>
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-red-500/80'}`}
                    title={active ? 'Active' : 'Not configured'}
                  />
                </li>
              );
            })}
          </ul>
          <a
            href={WEBHOOKS_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 py-2.5 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20 ${BTN_PRESS}`}
          >
            Open Shopify Webhooks
            <ExternalLink className="h-4 w-4" />
          </a>
        </GlassCard>

        {/* API Scopes */}
        <GlassCard className="p-5" delay={150}>
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-400" />
            <h2 className="font-semibold">API Scopes</h2>
          </div>
          {scopesLoading ? (
            <div className="flex h-32 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-5">
                <ScopeRing active={activeScopeCount} total={REQUIRED_SCOPES.length} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {activeScopeCount === REQUIRED_SCOPES.length
                      ? '✅ All scopes active'
                      : `${missingScopes.length} missing`}
                  </p>
                  {scopes?.error && (
                    <p className="mt-1 text-xs text-red-400">
                      {typeof scopes.error === 'string' ? scopes.error : 'Could not load scopes'}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {REQUIRED_SCOPES.map((id) => {
                      const ok = scopes?.scopes?.[id]?.ok;
                      return (
                        <span
                          key={id}
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                            ok
                              ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                              : 'border border-red-500/30 bg-red-500/15 text-red-400'
                          }`}
                        >
                          {ok ? '✅' : '❌'} {id}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {!scopes?.allOk && (
                  <button
                    type="button"
                    onClick={() => setFixModalOpen(true)}
                    className={`flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 ${BTN_PRESS}`}
                  >
                    How to fix
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadScopes}
                  disabled={scopesLoading}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600/50 py-2 text-xs text-muted hover:border-indigo-500/40 hover:text-foreground disabled:opacity-60 ${BTN_PRESS}`}
                >
                  {scopesLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {scopesLoading ? 'Checking…' : 'Re-check'}
                </button>
              </div>
            </>
          )}
        </GlassCard>

        {/* Product Sync */}
        <GlassCard className="p-5" delay={200}>
          <div className="mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-indigo-400" />
            <h2 className="font-semibold">Product Sync</h2>
          </div>
          <button
            type="button"
            onClick={() => handleSync(false)}
            disabled={syncing}
            className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 ${BTN_PRESS}`}
          >
            <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from Shopify'}
          </button>
          {syncResult && !syncing && (
            <p className="mt-2 text-center text-xs text-emerald-400">
              +{syncResult.new} new · {syncResult.updated} updated
            </p>
          )}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Auto-sync</p>
              <p className="text-xs text-muted">Every 5 minutes</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoSync}
              onClick={() => toggleAutoSync(!autoSync)}
              className={`relative h-7 w-12 rounded-full transition-colors ${autoSync ? 'bg-indigo-500' : 'bg-slate-600'} ${BTN_PRESS}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${autoSync ? 'translate-x-5' : ''}`}
              />
            </button>
          </div>
          {timeline.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-slate-700/50 pt-4">
              {timeline.map((entry, i) => (
                <li key={entry.at || i} className="flex items-center gap-2 text-xs text-muted">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-indigo-400/80" />
                  <span>
                    {(i === 0 && Date.now() - new Date(entry.at).getTime() < 120000
                      ? 'Just now'
                      : timeAgo(entry.at))}{' '}
                    — {entry.total} products
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        {/* Connection Health */}
        <GlassCard className="p-5" delay={250}>
          <div className="mb-4 flex items-center gap-2">
            <Radio className="h-5 w-5 text-indigo-400" />
            <h2 className="font-semibold">Connection</h2>
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className={`mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600/50 bg-slate-50 dark:bg-slate-900/40 py-2.5 text-sm font-medium hover:border-indigo-500/40 hover:text-indigo-300 disabled:opacity-50 ${BTN_PRESS}`}
          >
            <Zap className={`h-4 w-4 ${testing ? 'animate-pulse text-indigo-400' : ''}`} />
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <ul className="space-y-2">
            {HEALTH_ROWS.map(({ key, label, icon: Icon }, idx) => {
              const row = connectionTest?.[key];
              const isPinging = testing && pingStep === idx;
              const showResult = connectionTest && !testing;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-900/30 px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm">
                    {isPinging ? (
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative h-3 w-3 rounded-full bg-indigo-500" />
                      </span>
                    ) : (
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          showResult
                            ? row?.ok
                              ? 'bg-emerald-400'
                              : 'bg-red-500'
                            : 'bg-slate-600'
                        }`}
                      />
                    )}
                    <Icon className="h-4 w-4 text-muted" />
                    {label}
                  </span>
                  {showResult && row?.ms != null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        row.ok
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {row.ok ? `${row.ms}ms` : 'Fail'}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {connectionTest?.tested_at && !testing && (
            <p className="mt-3 text-center text-[10px] text-muted">
              Tested {timeAgo(connectionTest.tested_at)}
            </p>
          )}
        </GlassCard>

        {/* Danger Zone */}
        <GlassCard
          className="col-span-full border-red-500/20 bg-gradient-to-br from-red-950/30 to-slate-800/50 p-5"
          delay={300}
          danger
        >
          <div className="mb-4 flex items-center gap-2 text-red-400">
            <Trash2 className="h-5 w-5" />
            <h2 className="font-semibold">Danger Zone</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <button
                type="button"
                onClick={handleClearDatabase}
                disabled={clearing}
                className={`flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 py-3 text-sm font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-50 ${BTN_PRESS}`}
              >
                <Trash2 className="h-4 w-4" />
                {clearing ? 'Clearing…' : '🗑 Clear Cache'}
              </button>
              <p className="mt-2 text-center text-[10px] text-muted">
                Wipes local DB, re-syncs products
              </p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <button
                type="button"
                onClick={() => setSecretModalOpen(true)}
                className={`flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 py-3 text-sm font-medium text-red-300 hover:bg-red-500/30 ${BTN_PRESS}`}
              >
                <RefreshCw className="h-4 w-4" />
                🔄 Reset Webhook
              </button>
              <p className="mt-2 text-center text-[10px] text-muted">
                Update signing secret in .env
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <Modal open={fixModalOpen} onClose={() => setFixModalOpen(false)} title="Fix API scopes">
        {missingScopes.length > 0 && (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <span className="font-medium">Missing:</span>{' '}
            <span className="font-mono">{missingScopes.join(', ')}</span>
          </p>
        )}
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Go to Shopify Partners → Your App → Configuration</li>
          <li>Add the missing scopes listed above, then save changes</li>
          <li>Uninstall the app from your store</li>
          <li>Reinstall the app → a new access token is generated</li>
          <li>
            Update <code className="text-foreground">SHOPIFY_ACCESS_TOKEN</code> in{' '}
            <code className="text-foreground">server/.env</code>
          </li>
          <li>Restart the server</li>
          <li>Click “Re-check” on Settings to refresh scope status</li>
        </ol>
        <button
          type="button"
          onClick={() => {
            setFixModalOpen(false);
            loadScopes();
          }}
          className={`mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 ${BTN_PRESS}`}
        >
          Re-check scopes
        </button>
      </Modal>

      <Modal open={secretModalOpen} onClose={() => setSecretModalOpen(false)} title="Reset webhook secret">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Shopify Admin → Notifications → Webhooks</li>
          <li>Reveal / regenerate signing secret</li>
          <li>Set <code className="text-foreground">SHOPIFY_WEBHOOK_SECRET</code> in .env</li>
          <li>Restart server</li>
        </ol>
      </Modal>
    </div>
  );
}

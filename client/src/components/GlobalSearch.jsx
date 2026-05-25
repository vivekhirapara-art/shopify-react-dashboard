import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ShoppingCart, Users, X } from 'lucide-react';
import { api, formatCurrency } from '../api/client';
import { BTN_PRESS } from './premium-ui';

const SECTIONS = [
  { key: 'products', label: 'Products', icon: Package, path: '/products' },
  { key: 'orders', label: 'Orders', icon: ShoppingCart, path: '/orders' },
  { key: 'customers', label: 'Customers', icon: Users, path: '/customers' },
];

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ products: [], orders: [], customers: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const close = useCallback(() => {
    setExpanded(false);
    setOpen(false);
    setQuery('');
    setResults({ products: [], orders: [], customers: [] });
  }, []);

  const openSearch = useCallback(() => {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (expanded) close();
        else openSearch();
      }
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, close, openSearch]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        close();
      }
    }
    if (expanded) {
      document.addEventListener('mousedown', onClickOutside);
    }
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [expanded, close]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ products: [], orders: [], customers: [] });
      setOpen(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/search', { params: { q: query.trim() } });
        setResults({
          products: data.products || [],
          orders: data.orders || [],
          customers: data.customers || [],
        });
        setOpen(true);
      } catch {
        setResults({ products: [], orders: [], customers: [] });
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  function selectResult(path) {
    close();
    navigate(path);
  }

  const hasResults =
    results.products.length > 0 || results.orders.length > 0 || results.customers.length > 0;

  return (
    <div ref={wrapRef} className="relative w-64 shrink-0">
      {!expanded ? (
        <button
          type="button"
          onClick={openSearch}
          className={`flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:border-indigo-500/40 hover:text-indigo-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-indigo-300 ${BTN_PRESS}`}
          aria-label="Search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Search…</span>
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:border-slate-600/50 dark:bg-slate-800/80 xl:inline">
            Ctrl+K
          </kbd>
        </button>
      ) : (
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={close}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {expanded && open && query.trim() && (
        <div className="surface-card absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Searching…</p>
          ) : !hasResults ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No results for &quot;{query}&quot;</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-2">
              {SECTIONS.map(({ key, label, icon: Icon, path }) => {
                const items = results[key] || [];
                if (!items.length) return null;
                return (
                  <div key={key} className="mb-1">
                    <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {label}
                    </p>
                    {items.map((item) => (
                      <button
                        key={`${key}-${item.id}`}
                        type="button"
                        onClick={() => selectResult(path)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80 ${BTN_PRESS}`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{item.title}</p>
                          <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                        </div>
                        {item.price != null && (
                          <span className="shrink-0 text-sm font-medium text-indigo-400">
                            {formatCurrency(item.price)}
                          </span>
                        )}
                        {item.total_price != null && (
                          <span className="shrink-0 text-sm font-medium text-emerald-400">
                            {formatCurrency(item.total_price)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

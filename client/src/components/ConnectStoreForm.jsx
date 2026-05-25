import { useState } from 'react';
import { Store, Key, Eye, EyeOff, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { BTN_PRESS } from './premium-ui';

const STORE_URL_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

function normalizeDisplayUrl(input) {
  let url = String(input || '').trim().toLowerCase();
  url = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!url) return '';
  if (!url.includes('.')) url = `${url}.myshopify.com`;
  return url;
}

export default function ConnectStoreForm({
  onSuccess,
  submitLabel = 'Connect Store',
  showHelp = true,
  showHistory = false,
  compact = false,
}) {
  const { login, storeHistory, normalizeStoreInput } = useAuth();
  const [storeInput, setStoreInput] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [shake, setShake] = useState(false);

  const normalized = normalizeDisplayUrl(storeInput);
  const urlValid = STORE_URL_REGEX.test(normalized) || /^[a-z0-9][a-z0-9-]*$/i.test(storeInput.trim());

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setStatus('loading');
    try {
      await login(storeInput, token, { isSwitch: showHistory, reload: showHistory });
      setStatus('success');
      if (!showHistory) {
        setTimeout(() => {
          onSuccess?.();
        }, 600);
      }
    } catch (err) {
      setStatus('error');
      const msg = err.response?.data?.error || err.message || 'Connection failed';
      setError(
        msg === 'Network Error'
          ? 'Cannot reach server. Run npm run dev from project root and ensure port 5000 is free.'
          : msg
      );
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  function quickConnect(entry) {
    setStoreInput(entry.storeUrl);
    setToken(entry.accessToken || '');
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-slate-900 backdrop-blur-sm transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500';

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-4' : 'space-y-5'}>
      {showHistory && storeHistory?.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-slate-500">Recent stores</p>
          <div className="flex flex-wrap gap-2">
            {storeHistory.map((h) => (
              <button
                key={h.storeUrl}
                type="button"
                onClick={() => quickConnect(h)}
                className={`rounded-full border border-slate-600/50 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300 ${BTN_PRESS}`}
              >
                {h.storeName || h.storeUrl}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm text-slate-400">Store URL</label>
        <div className="relative">
          <Store className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={storeInput}
            onChange={(e) => setStoreInput(e.target.value)}
            onBlur={() => {
              if (storeInput && !storeInput.includes('.')) {
                setStoreInput(normalizeStoreInput(storeInput));
              }
            }}
            placeholder="your-store.myshopify.com"
            className={inputClass}
            autoComplete="off"
          />
          {urlValid && storeInput && (
            <Check className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm text-slate-400">Access Token</label>
        <div className="relative">
          <Key className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="shpat_xxxxxxxxxxxxxxxx"
            className={inputClass}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            tabIndex={-1}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading' || status === 'success' || !urlValid || !token.trim()}
        className={`connect-btn w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all ${BTN_PRESS} ${
          shake ? 'animate-shake' : ''
        } ${
          status === 'error'
            ? 'border-2 border-red-500 bg-red-500/20'
            : status === 'success'
              ? 'bg-emerald-600'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:scale-[1.02]'
        }`}
      >
        {status === 'loading' && (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
          </span>
        )}
        {status === 'success' && (
          <span className="inline-flex items-center justify-center gap-2">
            <Check className="h-4 w-4" /> Connected!
          </span>
        )}
        {status !== 'loading' && status !== 'success' && submitLabel}
      </button>

      {showHelp && (
        <div className="border-t border-slate-700/50 pt-4">
          <button
            type="button"
            onClick={() => setHelpOpen(!helpOpen)}
            className="flex w-full items-center justify-between text-sm text-indigo-400 hover:text-indigo-300"
          >
            How to get your Access Token?
            {helpOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {helpOpen && (
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-400">
              <li>Go to Shopify Partners → Apps</li>
              <li>Create a custom app</li>
              <li>Generate Admin API access token</li>
              <li>Copy and paste above</li>
            </ol>
          )}
        </div>
      )}
    </form>
  );
}
